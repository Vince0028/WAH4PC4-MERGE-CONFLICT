import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/patients — Fetch patient records
 * POST /api/patients — Save a new patient record
 * PUT /api/patients — Update an existing record
 * DELETE /api/patients — Delete a record
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabaseAdmin.from('ihomis_patients').select('*').eq('id', id).single();
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin.from('ihomis_patients').select('*').order('created_at', { ascending: false });
    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[iHOMIS API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from('ihomis_patients')
      .insert({
        patient_name: `${body.patient_lname}, ${body.patient_fname} ${body.patient_mname || ''}`.trim(),
        philhealth_no: body.philhealth_no,
        sex: body.sex,
        dob: body.dob || null,
        diagnosis_code: body.diagnosis_code,
        diagnosis_desc: body.diagnosis_desc,
        priority: body.priority || 'ROUTINE',
        hl7v2_payload: body,
        status: 'SAVED',
        source: 'LOCAL',
      })
      .select().single();
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    console.log(`[iHOMIS] Patient saved: ${data.id}`);
    return NextResponse.json({ success: true, data, message: 'Patient record saved' });
  } catch (error) {
    console.error('[iHOMIS Save] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });

    // If only status is being updated (e.g. from inbox accept), don't touch other fields
    const updateData: Record<string, unknown> = {};

    if (updates.status) updateData.status = updates.status;

    // Only rebuild payload fields if actual patient data is being updated
    if (updates.hl7v2_payload || updates.patient_fname || updates.patient_lname) {
      const payload = updates.hl7v2_payload || updates;
      updateData.patient_name = payload.patient_lname ? `${payload.patient_lname}, ${payload.patient_fname} ${payload.patient_mname || ''}`.trim() : undefined;
      updateData.philhealth_no = payload.philhealth_no;
      updateData.sex = payload.sex;
      updateData.dob = payload.dob || null;
      updateData.diagnosis_code = payload.diagnosis_code;
      updateData.diagnosis_desc = payload.diagnosis_desc;
      updateData.priority = payload.priority;
      updateData.hl7v2_payload = payload;
    }

    // Remove undefined keys
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

    const { data, error } = await supabaseAdmin.from('ihomis_patients').update(updateData).eq('id', id).select().single();
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data, message: 'Record updated' });
  } catch (error) {
    console.error('[iHOMIS Update] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('ihomis_patients').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    console.log(`[iHOMIS] Patient deleted: ${id}`);
    return NextResponse.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('[iHOMIS Delete] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
