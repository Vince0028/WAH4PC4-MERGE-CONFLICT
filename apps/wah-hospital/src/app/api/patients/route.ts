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
      const { data, error } = await supabaseAdmin.from('wah_patients').select('*').eq('id', id).single();
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    let query = supabaseAdmin.from('wah_patients').select('*').order('created_at', { ascending: false });
    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[WAH API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from('wah_patients')
      .insert({
        patient_name: body.patient_name,
        philhealth_no: body.philhealth_no,
        gender: body.gender,
        birth_date: body.birth_date || null,
        diagnosis_code: body.diagnosis_code,
        diagnosis_display: body.diagnosis_display,
        fhir_bundle: body.fhir_bundle,
        status: 'SAVED',
        source: 'LOCAL',
      })
      .select().single();
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    console.log(`[WAH] FHIR record saved: ${data.id}`);
    return NextResponse.json({ success: true, data, message: 'FHIR record saved' });
  } catch (error) {
    console.error('[WAH Save] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (updates.patient_name) updateData.patient_name = updates.patient_name;
    if (updates.philhealth_no) updateData.philhealth_no = updates.philhealth_no;
    if (updates.gender) updateData.gender = updates.gender;
    if (updates.birth_date) updateData.birth_date = updates.birth_date;
    if (updates.diagnosis_code) updateData.diagnosis_code = updates.diagnosis_code;
    if (updates.diagnosis_display) updateData.diagnosis_display = updates.diagnosis_display;
    if (updates.fhir_bundle) updateData.fhir_bundle = updates.fhir_bundle;
    if (updates.status) updateData.status = updates.status;

    const { data, error } = await supabaseAdmin.from('wah_patients').update(updateData).eq('id', id).select().single();
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data, message: 'Record updated' });
  } catch (error) {
    console.error('[WAH Update] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('wah_patients').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    console.log(`[WAH] Record deleted: ${id}`);
    return NextResponse.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('[WAH Delete] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
