import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/metrics
 * Returns aggregated dashboard metrics
 */
export async function GET() {
  try {
    // Fetch all counts in parallel
    const [totalRes, successRes, pendingRes, quarantinedRes, transformingRes, ihomisToWahRes, wahToIhomisRes] =
      await Promise.all([
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('status', 'SUCCESS'),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('status', 'QUARANTINED'),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('status', 'TRANSFORMING'),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('source_system', 'iHOMIS'),
        supabaseAdmin.from('adapt_transaction_logs').select('*', { count: 'exact', head: true }).eq('source_system', 'WAH'),
      ]);

    const total = totalRes.count || 0;
    const success = successRes.count || 0;
    const pending = pendingRes.count || 0;
    const quarantined = quarantinedRes.count || 0;
    const transforming = transformingRes.count || 0;
    const ihomisToWah = ihomisToWahRes.count || 0;
    const wahToIhomis = wahToIhomisRes.count || 0;

    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      metrics: {
        total_records: total,
        success_count: success,
        pending_count: pending,
        quarantined_count: quarantined,
        transforming_count: transforming,
        success_rate: successRate,
        ihomis_to_wah: ihomisToWah,
        wah_to_ihomis: wahToIhomis,
      },
    });
  } catch (error) {
    console.error('[iPaaS Metrics] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
