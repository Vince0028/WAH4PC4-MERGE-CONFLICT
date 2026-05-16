import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { transformWithGemini } from '@/lib/gemini';
import { validateTransformation } from '@/lib/validator';

/**
 * POST /api/ingest
 * Main ingestion endpoint — receives data from iHOMIS or WAH,
 * stores it in Supabase, triggers AI transformation, validates,
 * and forwards to the destination system.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_system, destination_system, payload, original_json, consent_signed } = body;

    // --- 1. Validate request ---
    if (!source_system || !destination_system || !payload) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: source_system, destination_system, payload' },
        { status: 400 }
      );
    }

    if (!['iHOMIS', 'WAH'].includes(source_system) || !['iHOMIS', 'WAH'].includes(destination_system)) {
      return NextResponse.json(
        { success: false, message: 'source_system and destination_system must be "iHOMIS" or "WAH"' },
        { status: 400 }
      );
    }

    if (source_system === destination_system) {
      return NextResponse.json(
        { success: false, message: 'source_system and destination_system cannot be the same' },
        { status: 400 }
      );
    }

    console.log(`[iPaaS Ingest] Received from ${source_system} → ${destination_system}`);

    // --- 1b. Check patient data privacy consent ---
    if (!consent_signed) {
      const consentError = 'Patient data privacy consent form not signed or agreed. Record cannot be processed without patient consent per Republic Act 10173 (Data Privacy Act of 2012).';
      console.warn(`[iPaaS Ingest] QUARANTINED — No consent: ${consentError}`);

      // Store the record as QUARANTINED immediately
      const rawPayloadForDb = typeof payload === 'string'
        ? { hl7v2_message: payload, format: 'HL7v2' }
        : payload;

      const { data: quarantinedRecord } = await supabaseAdmin
        .from('adapt_transaction_logs')
        .insert({
          source_system,
          destination_system,
          raw_payload: rawPayloadForDb,
          status: 'QUARANTINED',
          error_message: consentError,
        })
        .select()
        .single();

      return NextResponse.json({
        success: false,
        transaction_id: quarantinedRecord?.id,
        status: 'QUARANTINED',
        message: consentError,
      }, { status: 422 });
    }

    // --- 2. Insert into Supabase as PENDING ---
    // HL7 v2 comes as a string, FHIR comes as an object. Wrap strings for JSONB.
    const rawPayloadForDb = typeof payload === 'string' 
      ? { hl7v2_message: payload, format: 'HL7v2' } 
      : payload;

    const { data: insertedRecord, error: insertError } = await supabaseAdmin
      .from('adapt_transaction_logs')
      .insert({
        source_system,
        destination_system,
        raw_payload: rawPayloadForDb,
        status: 'PENDING',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[iPaaS Ingest] Supabase insert error:', insertError);
      return NextResponse.json(
        { success: false, message: 'Failed to store transaction', error: insertError.message },
        { status: 500 }
      );
    }

    const transactionId = insertedRecord.id;
    console.log(`[iPaaS Ingest] Transaction ${transactionId} stored as PENDING`);

    // --- 3. Update to TRANSFORMING ---
    await supabaseAdmin
      .from('adapt_transaction_logs')
      .update({ status: 'TRANSFORMING' })
      .eq('id', transactionId);

    console.log(`[iPaaS Ingest] Transaction ${transactionId} → TRANSFORMING`);

    // --- 4. AI Transformation via Gemini ---
    const direction = source_system === 'iHOMIS' ? 'IHOMIS_TO_FHIR' : 'FHIR_TO_IHOMIS';
    const transformResult = await transformWithGemini(payload, direction);

    if (!transformResult.success || !transformResult.data) {
      // Quarantine if transformation fails
      await supabaseAdmin
        .from('adapt_transaction_logs')
        .update({
          status: 'QUARANTINED',
          error_message: transformResult.error || 'AI transformation returned no data',
        })
        .eq('id', transactionId);

      console.error(`[iPaaS Ingest] Transaction ${transactionId} QUARANTINED: ${transformResult.error}`);

      return NextResponse.json({
        success: false,
        transaction_id: transactionId,
        status: 'QUARANTINED',
        message: `Transformation failed: ${transformResult.error}`,
      }, { status: 422 });
    }

    // --- 5. Validate the transformed output ---
    const validation = validateTransformation(transformResult.data, direction);

    if (!validation.valid) {
      // Quarantine if validation fails
      const errorMsg = `Validation errors: ${validation.errors.join('; ')}`;
      await supabaseAdmin
        .from('adapt_transaction_logs')
        .update({
          status: 'QUARANTINED',
          transformed_payload: transformResult.data,
          error_message: errorMsg,
        })
        .eq('id', transactionId);

      console.error(`[iPaaS Ingest] Transaction ${transactionId} QUARANTINED: ${errorMsg}`);

      return NextResponse.json({
        success: false,
        transaction_id: transactionId,
        status: 'QUARANTINED',
        message: errorMsg,
      }, { status: 422 });
    }

    // --- 6. Forward to destination system ---
    const webhookUrl = destination_system === 'iHOMIS'
      ? (process.env.IHOMIS_WEBHOOK_URL || 'http://localhost:3001/api/webhook')
      : (process.env.WAH_WEBHOOK_URL || 'http://localhost:3002/api/webhook');

    let forwardSuccess = false;
    let forwardError = '';

    try {
      const forwardResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          source_system,
          payload: transformResult.data,
          raw_source_payload: original_json || rawPayloadForDb, // Prefer clean JSON over HL7v2 wrapper
        }),
      });

      forwardSuccess = forwardResponse.ok;
      if (!forwardSuccess) {
        forwardError = `Webhook returned ${forwardResponse.status}`;
      }
    } catch (err) {
      forwardError = err instanceof Error ? err.message : 'Webhook request failed';
      console.warn(`[iPaaS Ingest] Forward to ${destination_system} failed: ${forwardError}`);
    }

    // --- 7. Update Supabase with final status ---
    const finalStatus = forwardSuccess ? 'SUCCESS' : 'SUCCESS'; // Still SUCCESS even if forward fails (data is transformed)
    await supabaseAdmin
      .from('adapt_transaction_logs')
      .update({
        status: finalStatus,
        transformed_payload: transformResult.data,
        error_message: forwardSuccess ? null : `Forwarding note: ${forwardError}`,
      })
      .eq('id', transactionId);

    console.log(`[iPaaS Ingest] Transaction ${transactionId} → ${finalStatus}`);

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      status: finalStatus,
      message: `Data transformed and ${forwardSuccess ? 'forwarded' : 'stored'} successfully`,
      forwarded: forwardSuccess,
    });

  } catch (error) {
    console.error('[iPaaS Ingest] Unexpected error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
