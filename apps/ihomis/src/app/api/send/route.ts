import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const IPAAS_URL = process.env.NEXT_PUBLIC_IPAAS_API_URL || 'http://localhost:3000/api';

/**
 * Build an HL7 v2 message from patient data
 * Format: Pipe-delimited segments (MSH, PID, PV1, OBX, DG1, RF1)
 */
function buildHL7v2Message(patient: Record<string, unknown>): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const vitals = (patient.vitals || {}) as Record<string, number>;

  const segments = [
    // MSH - Message Header
    `MSH|^~\\&|iHOMIS|${patient.referring_facility_code || 'DOH-001'}|ADAPT_IPAAS|ADAPT|${ts}||ADT^A01|MSG${Date.now()}|P|2.5`,

    // PID - Patient Identification
    `PID|1||${patient.philhealth_no}^^^PhilHealth^SB||${patient.patient_lname}^${patient.patient_fname}^${patient.patient_mname || ''}^^^${patient.patient_suffix || ''}||${(patient.dob as string || '').replace(/-/g, '')}|${patient.sex}|||${patient.address_street || ''}^^${patient.address_city || ''}^${patient.address_province || ''}^${patient.address_zip || ''}^PH|||${patient.civil_status || 'S'}|||||||||||||||${patient.contact_no || ''}`,

    // PV1 - Patient Visit
    `PV1|1|O|${patient.referring_facility_code || 'DOH-001'}|||||||${patient.referring_physician || ''}^${patient.referring_physician_license || ''}||||||||||||||||||||||||||||||${patient.priority || 'ROUTINE'}`,
  ];

  // OBX - Observations (Vital Signs)
  let obxSeq = 1;
  if (vitals.bp_systolic) segments.push(`OBX|${obxSeq++}|NM|8480-6^Systolic Blood Pressure^LN||${vitals.bp_systolic}|mmHg|||||F|||${ts}`);
  if (vitals.bp_diastolic) segments.push(`OBX|${obxSeq++}|NM|8462-4^Diastolic Blood Pressure^LN||${vitals.bp_diastolic}|mmHg|||||F|||${ts}`);
  if (vitals.heart_rate) segments.push(`OBX|${obxSeq++}|NM|8867-4^Heart Rate^LN||${vitals.heart_rate}|/min|||||F|||${ts}`);
  if (vitals.temperature) segments.push(`OBX|${obxSeq++}|NM|8310-5^Body Temperature^LN||${vitals.temperature}|Cel|||||F|||${ts}`);
  if (vitals.respiratory_rate) segments.push(`OBX|${obxSeq++}|NM|9279-1^Respiratory Rate^LN||${vitals.respiratory_rate}|/min|||||F|||${ts}`);
  if (vitals.oxygen_saturation) segments.push(`OBX|${obxSeq++}|NM|2708-6^Oxygen Saturation^LN||${vitals.oxygen_saturation}|%|||||F|||${ts}`);
  if (vitals.weight_kg) segments.push(`OBX|${obxSeq++}|NM|29463-7^Body Weight^LN||${vitals.weight_kg}|kg|||||F|||${ts}`);
  if (vitals.height_cm) segments.push(`OBX|${obxSeq++}|NM|8302-2^Body Height^LN||${vitals.height_cm}|cm|||||F|||${ts}`);

  // DG1 - Diagnosis
  if (patient.diagnosis_code) {
    segments.push(`DG1|1||${patient.diagnosis_code}^${patient.diagnosis_desc}^I10|||${patient.diagnosis_type || 'A'}||||||||${patient.chief_complaint || ''}`);
  }

  // RF1 - Referral Information
  segments.push(`RF1|${patient.priority || 'ROUTINE'}|${patient.referral_reason || ''}||${patient.referring_facility_name || ''}|${ts}`);

  return segments.join('\r');
}

/**
 * POST /api/send — Send a saved patient record to WAH via iPaaS as HL7 v2
 */
export async function POST(request: NextRequest) {
  try {
    const { patient_id } = await request.json();

    if (!patient_id) {
      return NextResponse.json({ success: false, message: 'patient_id is required' }, { status: 400 });
    }

    const { data: patient, error: fetchError } = await supabaseAdmin
      .from('ihomis_patients')
      .select('*')
      .eq('id', patient_id)
      .single();

    if (fetchError || !patient) {
      return NextResponse.json({ success: false, message: 'Patient record not found' }, { status: 404 });
    }

    // Build HL7 v2 message from the stored JSON payload
    const hl7Message = buildHL7v2Message(patient.hl7v2_payload || patient);

    console.log(`[iHOMIS Send] Sending HL7 v2 message for patient ${patient_id}...`);
    console.log(`[iHOMIS Send] HL7 v2 Preview:\n${hl7Message.split('\r').slice(0, 3).join('\n')}...`);

    // Send HL7 v2 to iPaaS for transformation to FHIR R4
    const ipaasRes = await fetch(`${IPAAS_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_system: 'iHOMIS',
        destination_system: 'WAH',
        payload: hl7Message,
        original_json: patient.hl7v2_payload, // Clean JSON for comparison
      }),
    });

    const ipaasData = await ipaasRes.json();

    if (ipaasData.success) {
      await supabaseAdmin
        .from('ihomis_patients')
        .update({ status: 'SENT' })
        .eq('id', patient_id);

      console.log(`[iHOMIS Send] Success. TX: ${ipaasData.transaction_id}`);
    }

    return NextResponse.json({
      success: ipaasData.success,
      transaction_id: ipaasData.transaction_id,
      message: ipaasData.success
        ? `HL7 v2 message sent via iPaaS (TX: ${ipaasData.transaction_id?.slice(0, 8)})`
        : ipaasData.message || 'Failed to send',
    });
  } catch (error) {
    console.error('[iHOMIS Send] Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to connect to iPaaS' }, { status: 500 });
  }
}
