'use client';
import { useState, useEffect } from 'react';
import WAHSidebar from '@/components/Sidebar';

async function safeFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, data: [] }; }
}

interface WAHRecord {
  id: string; patient_name: string; philhealth_no: string; gender: string;
  birth_date: string; diagnosis_code: string; diagnosis_display: string;
  status: string; source: string; created_at: string;
  fhir_bundle: Record<string, unknown>;
}

function extractFHIRFields(bundle: Record<string, unknown>): Record<string, string | null> {
  const fields: Record<string, string | null> = {};
  const entries = (bundle?.entry || []) as Array<Record<string, unknown>>;
  for (const entry of entries) {
    const res = entry.resource as Record<string, unknown>;
    if (!res) continue;
    if (res.resourceType === 'Patient') {
      const names = (res.name as Array<Record<string, unknown>>) || [];
      const name = names[0] || {};
      const given = ((name.given as string[]) || []).join(' ');
      fields['Patient Name'] = `${name.family || ''}, ${given}`.trim() || null;
      fields['Gender'] = (res.gender as string) || null;
      fields['Birth Date'] = (res.birthDate as string) || null;
      const ids = (res.identifier as Array<Record<string, unknown>>) || [];
      const ph = ids.find(i => ((i.system as string) || '').includes('philhealth'));
      fields['PhilHealth ID'] = ph ? (ph.value as string) : null;
      const tel = (res.telecom as Array<Record<string, unknown>>) || [];
      fields['Phone'] = tel[0] ? (tel[0].value as string) : null;
      const addr = (res.address as Array<Record<string, unknown>>) || [];
      if (addr[0]) {
        const lines = ((addr[0].line as string[]) || []).join(', ');
        fields['Address'] = [lines, addr[0].city, addr[0].district].filter(Boolean).join(', ') || null;
      } else fields['Address'] = null;
    }
    if (res.resourceType === 'Encounter') {
      const cls = res.class as Record<string, unknown>;
      fields['Encounter Class'] = cls ? (cls.code as string) : null;
      const pri = res.priority as Record<string, unknown>;
      fields['Priority'] = pri ? ((pri.coding as Array<Record<string, unknown>>) || [])[0]?.code as string : null;
      const svc = res.serviceProvider as Record<string, unknown>;
      fields['Facility'] = svc ? (svc.display as string) : null;
      const parts = (res.participant as Array<Record<string, unknown>>) || [];
      fields['Physician'] = parts[0] ? ((parts[0].individual as Record<string, unknown>)?.display as string) : null;
    }
    if (res.resourceType === 'Observation') {
      const code = res.code as Record<string, unknown>;
      const text = (code?.text as string) || ((code?.coding as Array<Record<string, unknown>>) || [])[0]?.display as string || 'Observation';
      const vq = res.valueQuantity as Record<string, unknown>;
      if (vq) fields[text] = `${vq.value} ${vq.unit || ''}`.trim();
    }
    if (res.resourceType === 'Condition') {
      const code = res.code as Record<string, unknown>;
      const coding = ((code?.coding as Array<Record<string, unknown>>) || []);
      fields['Diagnosis Code'] = coding[0] ? (coding[0].code as string) : null;
      fields['Diagnosis'] = coding[0] ? (coding[0].display as string) || (code?.text as string) : null;
    }
  }
  return fields;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<WAHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'summary'|'json'>('summary');
  const [toast, setToast] = useState<{type:'success'|'error', msg:string}|null>(null);
  const [deleteModal, setDeleteModal] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string|null>(null);

  const showToast = (type: 'success'|'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const fetchRecords = async () => {
    const [localRes, sentRes, acceptedRes] = await Promise.all([
      safeFetch('/api/patients?source=LOCAL&status=SAVED'),
      safeFetch('/api/patients?source=LOCAL&status=SENT'),
      safeFetch('/api/patients?source=RECEIVED&status=SAVED'),
    ]);
    const all = [...(localRes.data || []), ...(sentRes.data || []), ...(acceptedRes.data || [])];
    all.sort((a: WAHRecord, b: WAHRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecords(all);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleMoveToSend = async (id: string) => {
    setMovingId(id);
    try {
      const data = await safeFetch('/api/patients', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'QUEUED' }),
      });
      if (data.success) { showToast('success', 'Moved to Send Queue'); fetchRecords(); }
      else showToast('error', data.message || 'Failed');
    } catch { showToast('error', 'Failed'); }
    finally { setMovingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const data = await safeFetch(`/api/patients?id=${deleteModal}`, { method: 'DELETE' });
      if (data.success) { showToast('success', 'Record deleted'); fetchRecords(); }
      else showToast('error', data.message || 'Failed'); }
    catch { showToast('error', 'Failed'); }
    finally { setDeleting(false); setDeleteModal(null); }
  };

  return (
    <>
      <WAHSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">Records</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>All FHIR records — locally saved and accepted from inbox.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} /></div>
        ) : records.length === 0 ? (
          <div className="wah-card p-10 text-center"><p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No records yet.</p></div>
        ) : (
          <div className="space-y-3">
            {records.map(rec => {
              const isExpanded = expandedId === rec.id;
              const fields = isExpanded ? extractFHIRFields(rec.fhir_bundle) : {};
              return (
                <div key={rec.id} className="wah-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{rec.patient_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rec.birth_date || 'N/A'} · {rec.gender} · PhilHealth: {rec.philhealth_no}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.source === 'RECEIVED' && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>From DOH</span>}
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>FHIR R4</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                        background: rec.status === 'SENT' ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
                        color: rec.status === 'SENT' ? 'var(--color-success)' : 'var(--color-warning)',
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
                    {rec.status === 'SAVED' && rec.source === 'LOCAL' && (
                      <button onClick={() => handleMoveToSend(rec.id)} disabled={movingId === rec.id} className="wah-btn wah-btn-primary text-xs px-3 py-1.5">
                        {movingId === rec.id ? 'Moving...' : 'Move to Send Queue'}
                      </button>
                    )}
                    <button onClick={() => setDeleteModal(rec.id)} className="wah-btn text-xs px-3 py-1.5" style={{ color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.2)' }}>Delete</button>
                    <button onClick={() => { setExpandedId(isExpanded ? null : rec.id); setViewMode('summary'); }}
                      className="text-xs font-medium flex items-center gap-1 ml-auto" style={{ color: 'var(--color-accent-bright)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={isExpanded ? "6 9 12 15 18 9" : "9 18 15 12 9 6"}/></svg>
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-3">
                      <div className="flex gap-1 mb-3">
                        {(['summary', 'json'] as const).map(mode => (
                          <button key={mode} onClick={() => setViewMode(mode)} className="text-xs px-3 py-1.5 rounded font-medium transition-all" style={{
                            background: viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-bg-primary)',
                            color: viewMode === mode ? '#fff' : 'var(--color-text-secondary)',
                            border: `1px solid ${viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-border)'}`,
                          }}>{mode === 'summary' ? 'Field Summary' : 'FHIR Bundle'}</button>
                        ))}
                      </div>
                      {viewMode === 'summary' ? (
                        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)' }}>Patient Data — Present vs Missing</div>
                          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {Object.entries(fields).map(([key, val]) => (
                              <div key={key} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{key}</span>
                                {val ? (<span className="flex items-center gap-1.5 font-medium"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} />{val}</span>
                                ) : (<span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />Not provided</span>)}
                              </div>
                            ))}
                          </div>
                          <div className="px-3 py-2 text-[11px] flex items-center gap-4" style={{ background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border)' }}>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} /> Present: {Object.values(fields).filter(Boolean).length}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} /> Missing: {Object.values(fields).filter(v => !v).length}</span>
                          </div>
                        </div>
                      ) : (
                        <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>{JSON.stringify(rec.fhir_bundle, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="rounded-lg p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--color-bg-secondary)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </div>
                <div><p className="font-semibold text-sm">Delete Record</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This action cannot be undone.</p></div>
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>Permanently delete this FHIR record?</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteModal(null)} className="wah-btn wah-btn-secondary text-xs px-4 py-2">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="text-xs px-4 py-2 rounded font-medium text-white" style={{ background: '#dc2626' }}>{deleting ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </main>
    </>
  );
}
