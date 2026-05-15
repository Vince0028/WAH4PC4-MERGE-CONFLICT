'use client';
import { useState, useEffect } from 'react';
import WAHSidebar from '@/components/Sidebar';

async function safeFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, message: 'Invalid response', data: [] }; }
}

interface WAHRecord {
  id: string; patient_name: string; philhealth_no: string; gender: string;
  birth_date: string; diagnosis_code: string; diagnosis_display: string;
  status: string; source: string; created_at: string;
  fhir_bundle: Record<string, unknown>;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<WAHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [toast, setToast] = useState<{type:'success'|'error', msg:string}|null>(null);
  const [deleteModal, setDeleteModal] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (type: 'success'|'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const fetchRecords = async () => {
    // Show LOCAL records + RECEIVED records that were accepted (status=SAVED)
    const [localRes, acceptedRes] = await Promise.all([
      safeFetch('/api/patients?source=LOCAL'),
      safeFetch('/api/patients?source=RECEIVED&status=SAVED'),
    ]);
    const all = [...(localRes.data || []), ...(acceptedRes.data || [])];
    all.sort((a: WAHRecord, b: WAHRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecords(all);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSend = async (patientId: string) => {
    setSendingId(patientId);
    try {
      const data = await safeFetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: patientId }) });
      if (data.success) { showToast('success', data.message); fetchRecords(); }
      else showToast('error', data.message || 'Failed to send');
    } catch { showToast('error', 'Failed to connect to iPaaS'); }
    finally { setSendingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const data = await safeFetch(`/api/patients?id=${deleteModal}`, { method: 'DELETE' });
      if (data.success) { showToast('success', 'Record deleted'); fetchRecords(); }
      else showToast('error', data.message || 'Failed to delete');
    } catch { showToast('error', 'Failed to delete'); }
    finally { setDeleting(false); setDeleteModal(null); }
  };

  return (
    <>
      <WAHSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Records & Send</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage FHIR records. Send to DOH via iPaaS for FHIR R4 → HL7 v2 conversion.</p>
          </div>
          <button onClick={() => { setLoading(true); fetchRecords(); }} className="wah-btn wah-btn-secondary text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="wah-card p-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" className="mx-auto mb-3"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No FHIR records saved yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(rec => (
              <div key={rec.id} className="wah-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{rec.patient_name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rec.birth_date || 'N/A'} · {rec.gender} · PhilHealth: {rec.philhealth_no}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.source === 'RECEIVED' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>From DOH</span>
                    )}
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>FHIR R4</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                      background: rec.status === 'SAVED' ? 'rgba(217,119,6,0.08)' : 'rgba(5,150,105,0.08)',
                      color: rec.status === 'SAVED' ? 'var(--color-warning)' : 'var(--color-success)',
                    }}>{rec.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Dx:</span> <strong>{rec.diagnosis_code || 'N/A'}</strong></div>
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Desc:</span> <strong>{rec.diagnosis_display || 'N/A'}</strong></div>
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Resources:</span> <strong>{((rec.fhir_bundle as Record<string, unknown>)?.entry as unknown[] || []).length}</strong></div>
                  <div><span style={{ color: 'var(--color-text-muted)' }}>Created:</span> <strong>{new Date(rec.created_at).toLocaleDateString()}</strong></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {rec.status === 'SAVED' && (
                    <button onClick={() => handleSend(rec.id)} disabled={sendingId === rec.id} className="wah-btn wah-btn-primary text-xs px-3 py-1.5">
                      {sendingId === rec.id ? 'Sending...' : rec.source === 'RECEIVED' ? 'Forward to DOH' : 'Send to DOH'}
                    </button>
                  )}
                  <button onClick={() => setDeleteModal(rec.id)}
                    className="wah-btn text-xs px-3 py-1.5" style={{ color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    Delete
                  </button>
                  <button onClick={() => setViewId(viewId === rec.id ? null : rec.id)}
                    className="text-xs font-medium flex items-center gap-1 ml-auto" style={{ color: 'var(--color-accent-bright)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={viewId === rec.id ? "6 9 12 15 18 9" : "9 18 15 12 9 6"}/></svg>
                    {viewId === rec.id ? 'Hide FHIR' : 'View FHIR Bundle'}
                  </button>
                </div>
                {viewId === rec.id && (
                  <pre className="mt-3 p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '400px' }}>
                    {JSON.stringify(rec.fhir_bundle, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="rounded-lg p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--color-bg-secondary)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-sm">Delete Record</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                Are you sure you want to permanently delete this patient record? All associated data including the FHIR bundle will be removed.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteModal(null)} className="wah-btn wah-btn-secondary text-xs px-4 py-2">Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs px-4 py-2 rounded font-medium text-white" style={{ background: '#dc2626' }}>
                  {deleting ? 'Deleting...' : 'Delete Record'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </main>
    </>
  );
}
