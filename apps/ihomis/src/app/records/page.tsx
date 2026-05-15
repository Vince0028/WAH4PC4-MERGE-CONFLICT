'use client';
import { useState, useEffect } from 'react';
import IHOMISSidebar from '@/components/Sidebar';

async function safeFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { success: false, data: [] }; }
}

interface PatientRecord {
  id: string; patient_name: string; philhealth_no: string; sex: string;
  dob: string; diagnosis_code: string; diagnosis_desc: string;
  priority: string; status: string; source: string;
  hl7v2_payload: Record<string, unknown>;
  created_at: string;
}

function extractFields(p: Record<string, unknown>): Record<string, string | null> {
  const f: Record<string, string | null> = {};
  f['First Name'] = (p.patient_fname as string) || null;
  f['Last Name'] = (p.patient_lname as string) || null;
  f['Middle Name'] = (p.patient_mname as string) || null;
  f['Suffix'] = (p.patient_suffix as string) || null;
  f['Date of Birth'] = (p.dob as string) || null;
  f['Sex'] = (p.sex as string) || null;
  f['Civil Status'] = (p.civil_status as string) || null;
  f['PhilHealth No.'] = (p.philhealth_no as string) || null;
  f['Contact No.'] = (p.contact_no as string) || null;
  f['Street'] = (p.address_street as string) || null;
  f['City'] = (p.address_city as string) || null;
  f['Province'] = (p.address_province as string) || null;
  const v = p.vitals as Record<string, unknown> | undefined;
  if (v) {
    f['BP Systolic'] = v.bp_systolic ? `${v.bp_systolic} mmHg` : null;
    f['BP Diastolic'] = v.bp_diastolic ? `${v.bp_diastolic} mmHg` : null;
    f['Heart Rate'] = v.heart_rate ? `${v.heart_rate} /min` : null;
    f['Temperature'] = v.temperature ? `${v.temperature} °C` : null;
    f['Resp. Rate'] = v.respiratory_rate ? `${v.respiratory_rate} /min` : null;
    f['SpO2'] = v.oxygen_saturation ? `${v.oxygen_saturation} %` : null;
    f['Weight'] = v.weight_kg ? `${v.weight_kg} kg` : null;
    f['Height'] = v.height_cm ? `${v.height_cm} cm` : null;
  }
  f['Chief Complaint'] = (p.chief_complaint as string) || null;
  f['Diagnosis Code'] = (p.diagnosis_code as string) || null;
  f['Diagnosis'] = (p.diagnosis_desc as string) || null;
  f['Priority'] = (p.priority as string) || null;
  f['Facility'] = (p.referring_facility_name as string) || null;
  f['Physician'] = (p.referring_physician as string) || null;
  f['Referral Reason'] = (p.referral_reason as string) || null;
  return f;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [viewMode, setViewMode] = useState<'summary'|'json'>('summary');
  const [toast, setToast] = useState<{type:'success'|'error', msg:string}|null>(null);
  const [deleteModal, setDeleteModal] = useState<string|null>(null);
  const [deleting, setDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string|null>(null);

  const showToast = (type: 'success'|'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

  const fetchRecords = async () => {
    // Records = LOCAL with any status + RECEIVED that have been accepted (SAVED)
    const [localRes, sentRes, acceptedRes] = await Promise.all([
      safeFetch('/api/patients?source=LOCAL&status=SAVED'),
      safeFetch('/api/patients?source=LOCAL&status=SENT'),
      safeFetch('/api/patients?source=RECEIVED&status=SAVED'),
    ]);
    const all = [...(localRes.data || []), ...(sentRes.data || []), ...(acceptedRes.data || [])];
    all.sort((a: PatientRecord, b: PatientRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
      <IHOMISSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-5">
          <h1 className="text-lg font-semibold">Records</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>All patient records — locally saved and accepted from inbox.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="ihomis-card p-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No records yet. Create one from "New Patient Record".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(rec => {
              const isExpanded = expandedId === rec.id;
              const fields = isExpanded ? extractFields(rec.hl7v2_payload) : {};
              return (
                <div key={rec.id} className="ihomis-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{rec.patient_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rec.dob || 'N/A'} · {rec.sex} · PhilHealth: {rec.philhealth_no}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.source === 'RECEIVED' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>From WAH</span>
                      )}
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>HL7 v2</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                        background: rec.status === 'SENT' ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)',
                        color: rec.status === 'SENT' ? 'var(--color-success)' : 'var(--color-warning)',
                      }}>{rec.status}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Dx:</span> <strong>{rec.diagnosis_code || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Desc:</span> <strong>{rec.diagnosis_desc || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Priority:</span> <strong>{rec.priority || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Created:</span> <strong>{new Date(rec.created_at).toLocaleDateString()}</strong></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {rec.status === 'SAVED' && rec.source === 'LOCAL' && (
                      <button onClick={() => handleMoveToSend(rec.id)} disabled={movingId === rec.id}
                        className="ihomis-btn ihomis-btn-primary text-xs px-3 py-1.5">
                        {movingId === rec.id ? 'Moving...' : 'Move to Send Queue'}
                      </button>
                    )}
                    <button onClick={() => setDeleteModal(rec.id)}
                      className="ihomis-btn text-xs px-3 py-1.5" style={{ color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.2)' }}>
                      Delete
                    </button>
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
                          <button key={mode} onClick={() => setViewMode(mode)}
                            className="text-xs px-3 py-1.5 rounded font-medium transition-all"
                            style={{
                              background: viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-bg-primary)',
                              color: viewMode === mode ? '#fff' : 'var(--color-text-secondary)',
                              border: `1px solid ${viewMode === mode ? 'var(--color-accent-bright)' : 'var(--color-border)'}`,
                            }}>
                            {mode === 'summary' ? 'Field Summary' : 'Full JSON'}
                          </button>
                        ))}
                      </div>
                      {viewMode === 'summary' ? (
                        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--color-border)' }}>
                            Patient Data — Present vs Missing
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
                      ) : (
                        <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                          {JSON.stringify(rec.hl7v2_payload, null, 2)}
                        </pre>
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
                <div>
                  <p className="font-semibold text-sm">Delete Record</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>Permanently delete this patient record?</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteModal(null)} className="ihomis-btn ihomis-btn-secondary text-xs px-4 py-2">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="text-xs px-4 py-2 rounded font-medium text-white" style={{ background: '#dc2626' }}>
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
