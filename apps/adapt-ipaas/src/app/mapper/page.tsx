'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

async function safeFetch(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, data: [] }; }
}

interface Transaction {
  id: string; source_system: string; destination_system: string;
  status: string; raw_payload: Record<string, unknown>;
  transformed_payload: Record<string, unknown> | null;
  error_message: string | null; created_at: string;
}

export default function MapperPage() {
  return (
    <Suspense fallback={
      <><Sidebar /><main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} />
      </main></>
    }>
      <MapperContent />
    </Suspense>
  );
}

function MapperContent() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('id');
  const [tx, setTx] = useState<Transaction | null>(null);
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const data = await safeFetch('/api/transactions?limit=50');
      if (data.success) {
        setAllTx(data.data || []);
        if (txId) {
          const found = data.data?.find((t: Transaction) => t.id === txId);
          if (found) setTx(found);
        } else if (data.data?.length > 0) {
          setTx(data.data[0]);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [txId]);

  const statusStyle = (s: string) => {
    const m: Record<string, { bg: string; color: string }> = {
      SUCCESS: { bg: 'rgba(5,150,105,0.08)', color: '#059669' },
      PENDING: { bg: 'rgba(217,119,6,0.08)', color: '#d97706' },
      TRANSFORMING: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb' },
      QUARANTINED: { bg: 'rgba(220,38,38,0.08)', color: '#dc2626' },
    };
    return m[s] || m.PENDING;
  };

  const rawLabel = (src: string) => src === 'iHOMIS' ? 'HL7 v2 Payload' : 'FHIR R4 Bundle';
  const transformedLabel = (dest: string) => dest === 'WAH' ? 'PH Core FHIR R4' : 'iHOMIS Format';

  return (
    <>
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">Data Mapper</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Side-by-side view of raw input and AI-transformed output</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} />
          </div>
        ) : !tx ? (
          <div className="ipaas-card p-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" className="mx-auto mb-3"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No transactions to display. Send data from iHOMIS or WAH first.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <select value={tx.id} onChange={e => { const found = allTx.find(t => t.id === e.target.value); if (found) setTx(found); }}
                className="px-3 py-2 rounded-md text-xs outline-none w-full max-w-md" style={{ background: '#fff', border: '1px solid var(--color-border)' }}>
                {allTx.map(t => <option key={t.id} value={t.id}>{t.id.slice(0, 8)} — {t.source_system} → {t.destination_system} ({t.status})</option>)}
              </select>
            </div>

            <div className="ipaas-card p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                    background: tx.source_system === 'iHOMIS' ? 'rgba(37,99,235,0.08)' : 'rgba(5,150,105,0.08)',
                    color: tx.source_system === 'iHOMIS' ? '#2563eb' : '#059669',
                  }}>{tx.source_system}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{
                    background: tx.destination_system === 'iHOMIS' ? 'rgba(37,99,235,0.08)' : 'rgba(5,150,105,0.08)',
                    color: tx.destination_system === 'iHOMIS' ? '#2563eb' : '#059669',
                  }}>{tx.destination_system}</span>
                  <span className="ipaas-badge" style={{ ...statusStyle(tx.status) }}>{tx.status}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{new Date(tx.created_at).toLocaleString()}</p>
              </div>
              {tx.error_message && (
                <div className="mt-3 p-2.5 rounded text-xs flex items-center gap-2" style={{ background: 'rgba(220,38,38,0.05)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  {tx.error_message}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="ipaas-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-warning)' }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide">Raw — {rawLabel(tx.source_system)}</h3>
                </div>
                <pre className="p-3 rounded text-xs overflow-auto" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '600px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {JSON.stringify(tx.raw_payload, null, 2)}
                </pre>
              </div>
              <div className="ipaas-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-success)' }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wide">Transformed — {transformedLabel(tx.destination_system)}</h3>
                </div>
                {tx.transformed_payload ? (
                  <pre className="p-3 rounded text-xs overflow-auto" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '600px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {JSON.stringify(tx.transformed_payload, null, 2)}
                  </pre>
                ) : (
                  <div className="p-8 text-center rounded" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Transformation pending or failed</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
