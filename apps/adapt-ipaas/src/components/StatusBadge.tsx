'use client';

interface StatusBadgeProps {
  status: 'SUCCESS' | 'PENDING' | 'QUARANTINED' | 'TRANSFORMING';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    SUCCESS: { className: 'status-success', dot: 'var(--color-success)', label: 'Success' },
    PENDING: { className: 'status-pending', dot: 'var(--color-warning)', label: 'Pending' },
    QUARANTINED: { className: 'status-quarantined', dot: 'var(--color-error)', label: 'Quarantined' },
    TRANSFORMING: { className: 'status-transforming', dot: 'var(--color-info)', label: 'Transforming' },
  };

  const { className, dot, label } = config[status] || config.PENDING;

  return (
    <span className={`status-badge ${className}`}>
      <span className="pulse-dot" style={{ background: dot, width: '6px', height: '6px' }} />
      {label}
    </span>
  );
}
