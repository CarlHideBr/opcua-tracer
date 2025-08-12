import React from 'react';
import { useAppStore } from '../store';

export const Notifications: React.FC = () => {
  const notifications = useAppStore(s => s.notifications);
  const removeNotification = useAppStore(s => s.actions.removeNotification);
  return (
    <div className="notifications-container">
      {notifications.map(n => (
        <div key={n.id} className="card notification-card" style={{ borderLeft: `3px solid ${n.type==='error'?'#ef4444':n.type==='success'?'#22c55e':n.type==='warning'?'#f59e0b':'#60a5fa'}` }}>
          <div className="notification-title-row">
            <div style={{ fontWeight: 600, color: 'var(--muted)' }}>{n.type.toUpperCase()}</div>
            <button className="icon-button" onClick={() => removeNotification(n.id)}>
              ×
            </button>
          </div>
          <div style={{ marginTop: 6 }}>{n.message}</div>
          {n.actions && n.actions.length > 0 && (
            <div className="notification-actions">
              {n.actions.map((a, idx) => (
                <button key={idx}
                  className={
                    'button' +
                    (a.variant === 'danger' ? ' button--danger' : '') +
                    (a.variant === 'neutral' ? ' button--ghost' : '')
                  }
                  onClick={a.onClick}
                >{a.label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
