'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

async function safeFetch(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, data: [] }; }
}

// SHA-256 hash function (browser-compatible)
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Synchronous hash for initial display
function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`.slice(0, 64);
}

interface Transaction {
  id: string; source_system: string; destination_system: string;
  status: string; raw_payload: Record<string, unknown>;
  transformed_payload: Record<string, unknown> | null;
  error_message: string | null; created_at: string;
}

// Hashable payload panel component
function HashablePayload({ label, dotColor, payload }: { label: string; dotColor: string; payload: Record<string, unknown> | null }) {
  const [revealed, setRevealed] = useState(false);
  const [hash, setHash] = useState<string>('');

  const jsonStr = payload ? JSON.stringify(payload, null, 2) : '';

  useEffect(() => {
    if (jsonStr) {
      setHash(simpleHash(jsonStr));
      sha256(jsonStr).then(setHash);
    }
  }, [jsonStr]);

  if (!payload) {
    return (
      <div className="ipaas-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} />
          <h3 className="text-xs font-semibold uppercase tracking-wide">{label}</h3>
        </div>
        <div className="p-8 text-center rounded" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Transformation pending or failed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ipaas-card p-4" style={revealed ? { borderColor: 'rgba(139,92,246,0.3)' } : {}}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} />
          <h3 className="text-xs font-semibold uppercase tracking-wide">{label}</h3>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{
            background: revealed ? 'rgba(139,92,246,0.08)' : 'rgba(245,158,11,0.08)',
            color: revealed ? '#8b5cf6' : '#f59e0b',
          }}>
            {revealed ? 'REVEALED' : 'SHA-256 HASHED'}
          </span>
        </div>
        <button
          onClick={() => setRevealed(!revealed)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all"
          style={{
            background: revealed ? 'rgba(220,38,38,0.06)' : 'rgba(139,92,246,0.06)',
            color: revealed ? '#dc2626' : '#8b5cf6',
            border: `1px solid ${revealed ? 'rgba(220,38,38,0.15)' : 'rgba(139,92,246,0.15)'}`,
          }}
        >
          {revealed ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              Re-hash
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Unhash
            </>
          )}
        </button>
      </div>
      <pre
        className="p-3 rounded text-xs overflow-auto"
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          maxHeight: '600px',
          fontFamily: "'JetBrains Mono', monospace",
          color: revealed ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          wordBreak: revealed ? 'break-word' : 'break-all',
          whiteSpace: revealed ? 'pre-wrap' : 'nowrap',
        }}
      >
        {revealed ? jsonStr : hash}
      </pre>
    </div>
  );
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
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Side-by-side view of raw input and AI-transformed output. All payloads are SHA-256 hashed by default.</p>
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
              <HashablePayload
                label={`Raw — ${rawLabel(tx.source_system)}`}
                dotColor="var(--color-warning)"
                payload={tx.raw_payload}
              />
              <HashablePayload
                label={`Transformed — ${transformedLabel(tx.destination_system)}`}
                dotColor="var(--color-success)"
                payload={tx.transformed_payload}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
