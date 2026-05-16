import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const IPAAS_URL = process.env.NEXT_PUBLIC_IPAAS_API_URL || 'http://localhost:3000/api';

/**
 * POST /api/send — Send a saved FHIR record to iHOMIS via iPaaS
 */
export async function POST(request: NextRequest) {
  try {
    const { patient_id } = await request.json();

    if (!patient_id) {
      return NextResponse.json({ success: false, message: 'patient_id is required' }, { status: 400 });
    }

    // 1. Fetch the patient record from local DB
    const { data: patient, error: fetchError } = await supabaseAdmin
      .from('wah_patients')
      .select('*')
      .eq('id', patient_id)
      .single();

    if (fetchError || !patient) {
      return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    }

    // 2. Send the FHIR bundle to iPaaS
    console.log(`[WAH Send] Sending patient ${patient_id} to iPaaS...`);

    const ipaasRes = await fetch(`${IPAAS_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_system: 'WAH',
        destination_system: 'iHOMIS',
        payload: patient.fhir_bundle,
        original_json: patient.fhir_bundle, // Clean FHIR for comparison
        consent_signed: patient.consent_signed ?? false,
      }),
    });

    const ipaasData = await ipaasRes.json();

    // 3. Update local record status
    if (ipaasData.success) {
      await supabaseAdmin
        .from('wah_patients')
        .update({ status: 'SENT' })
        .eq('id', patient_id);

      console.log(`[WAH Send] Record ${patient_id} sent. TX: ${ipaasData.transaction_id}`);
    } else {
      // Rejected by iPaaS (e.g. no consent, validation failure)
      await supabaseAdmin
        .from('wah_patients')
        .update({
          status: 'REJECTED',
          rejection_reason: ipaasData.message || 'Rejected by iPaaS',
        })
        .eq('id', patient_id);

      console.warn(`[WAH Send] Record ${patient_id} REJECTED: ${ipaasData.message}`);
    }

    return NextResponse.json({
      success: ipaasData.success,
      transaction_id: ipaasData.transaction_id,
      status: ipaasData.success ? 'SENT' : 'REJECTED',
      message: ipaasData.success
        ? `FHIR Bundle sent to DOH via iPaaS (TX: ${ipaasData.transaction_id?.slice(0, 8)})`
        : ipaasData.message || 'Failed to send',
    });
  } catch (error) {
    console.error('[WAH Send] Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to connect to iPaaS' }, { status: 500 });
  }
}
