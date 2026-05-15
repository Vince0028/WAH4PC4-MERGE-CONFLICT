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
  fhir_bundle: Record<string, unknown>;
  raw_source_payload: Record<string, unknown> | null;
  created_at: string; status: string;
}

function formatHL7(raw: Record<string, unknown> | null): string {
  if (!raw) return 'Original payload not available';
  const msg = (raw as Record<string, string>).hl7v2_message || '';
  if (!msg) return JSON.stringify(raw, null, 2);
  return msg.replace(/\r?\n/g, '\n').replace(/(MSH|PID|PV1|PV2|OBX|DG1|RF1|IN1|NK1|EVN|AL1)/g, '\n$1').trim();
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
      const ms = res.maritalStatus as Record<string, unknown>;
      fields['Marital Status'] = ms ? ((ms.coding as Array<Record<string, unknown>>) || [])[0]?.code as string : null;
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
      const reasons = (res.reasonCode as Array<Record<string, unknown>>) || [];
      fields['Reason'] = reasons[0] ? (reasons[0].text as string) : null;
    }
    if (res.resourceType === 'Observation') {
      const code = res.code as Record<string, unknown>;
      const text = (code?.text as string) || ((code?.coding as Array<Record<string, unknown>>) || [])[0]?.display as string || 'Observation';
      const vq = res.valueQuantity as Record<string, unknown>;
      if (vq) {
        fields[text] = `${vq.value} ${vq.unit || ''}`.trim();
      } else {
        const comps = (res.component as Array<Record<string, unknown>>) || [];
        if (comps.length > 0) {
          const vals = comps.map(c => { const cv = c.valueQuantity as Record<string, unknown>; return cv ? `${cv.value}` : '?'; });
          fields[text] = vals.join('/') + ' mmHg';
        }
      }
    }
    if (res.resourceType === 'Condition') {
      const code = res.code as Record<string, unknown>;
      const coding = ((code?.coding as Array<Record<string, unknown>>) || []);
      fields['Diagnosis Code'] = coding[0] ? (coding[0].code as string) : null;
      fields['Diagnosis Display'] = coding[0] ? (coding[0].display as string) || (code?.text as string) : null;
      const notes = (res.note as Array<Record<string, unknown>>) || [];
      fields['Chief Complaint'] = notes[0] ? (notes[0].text as string) : null;
    }
  }
  return fields;
}

export default function InboxPage() {
  const [records, setRecords] = useState<WAHRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'summary'|'transformed'|'raw'|'compare'>('summary');
  const [deleteModal, setDeleteModal] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string|null>(null);
  const [toast, setToast] = useState<{type:'success'|'error', msg:string}|null>(null);

  const showToast = (type: 'success'|'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const fetchInbox = async () => {
    const data = await safeFetch('/api/patients?source=RECEIVED&status=RECEIVED');
    if (data.success) setRecords(data.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchInbox(); const i = setInterval(fetchInbox, 10000); return () => clearInterval(i); }, []);

  const handleAccept = async (id: string) => {
    setAcceptingId(id);
    try {
      const data = await safeFetch('/api/patients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'SAVED' }),
      });
      if (data.success) { showToast('success', 'Record accepted to Records'); fetchInbox(); }
      else showToast('error', data.message || 'Failed to accept');
    } catch { showToast('error', 'Failed to accept record'); }
    finally { setAcceptingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const data = await safeFetch(`/api/patients?id=${deleteModal}`, { method: 'DELETE' });
      if (data.success) { showToast('success', 'Record deleted'); fetchInbox(); }
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
            <h1 className="text-lg font-semibold">Inbox</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Records received from iHOMIS — converted from HL7 v2 to FHIR R4 by iPaaS AI</p>
          </div>
          <button onClick={() => { setLoading(true); fetchInbox(); }} className="wah-btn wah-btn-secondary text-xs">
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" className="mx-auto mb-3"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No incoming records</p>
          </div>
        ) : (
          <div className="space-y-3" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: '4px' }}>
            {records.map(rec => {
              const isExpanded = expandedId === rec.id;
              const fields = isExpanded ? extractFHIRFields(rec.fhir_bundle) : {};
              return (
                <div key={rec.id} className="wah-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{rec.patient_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>From: iHOMIS (DOH) · {new Date(rec.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>FHIR R4</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(5,150,105,0.08)', color: 'var(--color-success)' }}>Received</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                    <div><span style={{ color: 'var(--color-text-muted)' }}>PhilHealth:</span> <strong>{rec.philhealth_no || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>DOB:</span> <strong>{rec.birth_date || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Gender:</span> <strong>{rec.gender || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Dx:</span> <strong>{rec.diagnosis_code || 'N/A'}</strong></div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <button onClick={() => handleAccept(rec.id)} disabled={acceptingId === rec.id}
                      className="wah-btn wah-btn-primary text-xs px-3 py-1.5">
                      {acceptingId === rec.id ? 'Accepting...' : 'Accept to Records'}
                    </button>
                    <button onClick={() => setDeleteModal(rec.id)}
                      className="wah-btn text-xs px-3 py-1.5" style={{ color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.2)' }}>
                      Delete
                    </button>
                    <button onClick={() => { setExpandedId(isExpanded ? null : rec.id); setViewMode('summary'); }}
                      className="text-xs font-medium flex items-center gap-1 ml-auto" style={{ color: 'var(--color-accent-bright)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={isExpanded ? "6 9 12 15 18 9" : "9 18 15 12 9 6"}/></svg>
                      {isExpanded ? 'Hide visualizer' : 'View data comparison'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3">
                      <div className="flex gap-1 mb-3 flex-wrap">
                        {(['summary', 'transformed', 'raw', 'compare'] as const).map(mode => (
                          <button key={mode} onClick={() => setViewMode(mode)}
                            className="text-xs px-3 py-1.5 rounded font-medium transition-all"
                            style={{
                              background: viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-bg-primary)',
                              color: viewMode === mode ? '#fff' : 'var(--color-text-secondary)',
                              border: `1px solid ${viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-border)'}`,
                            }}>
                            {mode === 'summary' ? 'Field Summary' : mode === 'transformed' ? 'FHIR R4 JSON' : mode === 'raw' ? 'Original (iHOMIS)' : 'Compare'}
                          </button>
                        ))}
                      </div>

                      {viewMode === 'summary' ? (
                        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)' }}>
                            Received Data Fields — Present vs Missing
                          </div>
                          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                            {Object.entries(fields).map(([key, val]) => (
                              <div key={key} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{key}</span>
                                {val ? (
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} />
                                    {val}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />
                                    Not provided
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="px-3 py-2 text-[11px] flex items-center gap-4" style={{ background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border)' }}>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} /> Present: {Object.values(fields).filter(Boolean).length}</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} /> Missing: {Object.values(fields).filter(v => !v).length}</span>
                          </div>
                        </div>
                      ) : viewMode === 'compare' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: '#d97706' }} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Original — iHOMIS Source Data</span>
                            </div>
                            <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                              {rec.raw_source_payload ? JSON.stringify(rec.raw_source_payload, null, 2) : 'Original payload not available'}
                            </pre>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: '#059669' }} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Transformed — FHIR R4 Bundle</span>
                            </div>
                            <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                              {JSON.stringify(rec.fhir_bundle, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : viewMode === 'raw' ? (
                        <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                          {rec.raw_source_payload ? JSON.stringify(rec.raw_source_payload, null, 2) : 'Original payload not available'}
                        </pre>
                      ) : (
                        <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                          {JSON.stringify(rec.fhir_bundle, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                Are you sure you want to permanently delete this received record?
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteModal(null)} className="wah-btn wah-btn-secondary text-xs px-4 py-2">Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="text-xs px-4 py-2 rounded font-medium text-white" style={{ background: '#dc2626' }}>
                  {deleting ? 'Deleting...' : 'Delete'}
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
