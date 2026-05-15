'use client';
import IHOMISSidebar from '@/components/Sidebar';

export default function IHOMISDashboard() {
  return (
    <>
      <IHOMISSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Integrated Hospital Operations & Management Information System</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="ihomis-card p-5" style={{ borderLeft: '3px solid var(--color-accent-bright)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>System</p>
            <p className="text-base font-semibold mt-1">iHOMIS v2.0</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>HL7 v2 Messaging Format</p>
          </div>
          <div className="ihomis-card p-5" style={{ borderLeft: '3px solid var(--color-success)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Database</p>
            <p className="text-base font-semibold mt-1">Supabase</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Dedicated iHOMIS instance</p>
          </div>
          <div className="ihomis-card p-5" style={{ borderLeft: '3px solid var(--color-warning)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Exchange Format</p>
            <p className="text-base font-semibold mt-1">HL7 v2.x</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>MSH|PID|OBX segments</p>
          </div>
        </div>
        <div className="ihomis-card p-6">
          <h2 className="text-sm font-semibold mb-4">Data Exchange Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-bright)" strokeWidth="1.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-medium">1. Save Record</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Store patient data locally as HL7 v2</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-medium">2. Send via iPaaS</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>AI converts HL7 v2 → FHIR R4</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(5,150,105,0.08)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-medium">3. Receive</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Get converted HL7 v2 from WAH</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <a href="/save" className="ihomis-btn ihomis-btn-primary text-sm">New Patient Record</a>
            <a href="/records" className="ihomis-btn ihomis-btn-secondary text-sm">Records & Send</a>
          </div>
        </div>
      </main>
    </>
  );
}
