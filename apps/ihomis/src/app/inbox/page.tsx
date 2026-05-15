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
  priority: string; hl7v2_payload: Record<string, unknown>;
  raw_source_payload: Record<string, unknown> | null;
  created_at: string; status: string;
}

function extractIHOMISFields(payload: Record<string, unknown>): Record<string, string | null> {
  const f: Record<string, string | null> = {};
  f['First Name'] = (payload.patient_fname as string) || null;
  f['Last Name'] = (payload.patient_lname as string) || null;
  f['Middle Name'] = (payload.patient_mname as string) || null;
  f['Suffix'] = (payload.patient_suffix as string) || null;
  f['Date of Birth'] = (payload.dob as string) || null;
  f['Sex'] = (payload.sex as string) || null;
  f['Civil Status'] = (payload.civil_status as string) || null;
  f['PhilHealth No.'] = (payload.philhealth_no as string) || null;
  f['Contact No.'] = (payload.contact_no as string) || null;
  f['Street'] = (payload.address_street as string) || null;
  f['City'] = (payload.address_city as string) || null;
  f['Province'] = (payload.address_province as string) || null;
  const vitals = payload.vitals as Record<string, unknown> | undefined;
  if (vitals) {
    f['BP Systolic'] = vitals.bp_systolic ? String(vitals.bp_systolic) : null;
    f['BP Diastolic'] = vitals.bp_diastolic ? String(vitals.bp_diastolic) : null;
    f['Heart Rate'] = vitals.heart_rate ? String(vitals.heart_rate) : null;
    f['Temperature'] = vitals.temperature ? String(vitals.temperature) : null;
    f['Resp. Rate'] = vitals.respiratory_rate ? String(vitals.respiratory_rate) : null;
    f['SpO2'] = vitals.oxygen_saturation ? String(vitals.oxygen_saturation) : null;
    f['Weight (kg)'] = vitals.weight_kg ? String(vitals.weight_kg) : null;
    f['Height (cm)'] = vitals.height_cm ? String(vitals.height_cm) : null;
  }
  f['Chief Complaint'] = (payload.chief_complaint as string) || null;
  f['Diagnosis Code'] = (payload.diagnosis_code as string) || null;
  f['Diagnosis Desc'] = (payload.diagnosis_desc as string) || null;
  f['Priority'] = (payload.priority as string) || null;
  f['Facility'] = (payload.referring_facility_name as string) || null;
  f['Physician'] = (payload.referring_physician as string) || null;
  f['Referral Reason'] = (payload.referral_reason as string) || null;
  return f;
}

export default function InboxPage() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'SAVED' }),
      });
      if (data.success) { showToast('success', 'Record accepted to Records'); fetchInbox(); }
      else showToast('error', data.message || 'Failed');
    } catch { showToast('error', 'Failed'); }
    finally { setAcceptingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const data = await safeFetch(`/api/patients?id=${deleteModal}`, { method: 'DELETE' });
      if (data.success) { showToast('success', 'Record deleted'); fetchInbox(); }
      else showToast('error', data.message || 'Failed');
    } catch { showToast('error', 'Failed'); }
    finally { setDeleting(false); setDeleteModal(null); }
  };

  return (
    <>
      <IHOMISSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Inbox</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Records received from WAH — converted from FHIR R4 to iHOMIS format by iPaaS AI</p>
          </div>
          <button onClick={() => { setLoading(true); fetchInbox(); }} className="ihomis-btn ihomis-btn-secondary text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-bright)' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="ihomis-card p-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1" className="mx-auto mb-3"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>No incoming records</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(rec => {
              const isExpanded = expandedId === rec.id;
              const fields = isExpanded ? extractIHOMISFields(rec.hl7v2_payload) : {};
              return (
                <div key={rec.id} className="ihomis-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">{rec.patient_name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>From: WAH Hospital · {new Date(rec.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>HL7 v2</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(5,150,105,0.08)', color: 'var(--color-success)' }}>Received</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                    <div><span style={{ color: 'var(--color-text-muted)' }}>PhilHealth:</span> <strong>{rec.philhealth_no || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>DOB:</span> <strong>{rec.dob || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Sex:</span> <strong>{rec.sex || 'N/A'}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)' }}>Dx:</span> <strong>{rec.diagnosis_code || 'N/A'}</strong></div>
                  </div>

                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <button onClick={() => handleAccept(rec.id)} disabled={acceptingId === rec.id}
                      className="ihomis-btn ihomis-btn-primary text-xs px-3 py-1.5">
                      {acceptingId === rec.id ? 'Accepting...' : 'Accept to Records'}
                    </button>
                    <button onClick={() => setDeleteModal(rec.id)}
                      className="ihomis-btn text-xs px-3 py-1.5" style={{ color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.2)' }}>
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
                            {mode === 'summary' ? 'Field Summary' : mode === 'transformed' ? 'iHOMIS JSON' : mode === 'raw' ? 'Original (FHIR R4)' : 'Compare'}
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
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Original — FHIR R4 from WAH</span>
                            </div>
                            <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                              {rec.raw_source_payload ? JSON.stringify(rec.raw_source_payload, null, 2) : 'Original not available'}
                            </pre>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: '#059669' }} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide">Transformed — iHOMIS Format</span>
                            </div>
                            <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                              {JSON.stringify(rec.hl7v2_payload, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : viewMode === 'raw' ? (
                        <pre className="p-3 rounded text-xs overflow-auto whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', maxHeight: '500px' }}>
                          {rec.raw_source_payload ? JSON.stringify(rec.raw_source_payload, null, 2) : 'Original not available'}
                        </pre>
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
                <button onClick={() => setDeleteModal(null)} className="ihomis-btn ihomis-btn-secondary text-xs px-4 py-2">Cancel</button>
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
