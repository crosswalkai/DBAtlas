// SessionHistory.tsx
import React, { useState, useEffect } from 'react';
import { getSession } from '../api/client';
import { Badge, SeverityBadge, SectionLabel } from './ui';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SessionSummary {
  session_id: string;
  state: string;
  mode: string;
  dbms: string;
  server_name: string;
  ticket_number: string;
  playbook_id: string;
  severity?: string;
  created_at: string;
}

interface Props {
  onReopen: (sessionId: string) => void;
}

export function SessionHistory({ onReopen }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BASE}/api/v1/sessions`)
      .then(r => { setSessions(r.data.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading sessions...
    </div>
  );

  if (sessions.length === 0) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🗂</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
        No sessions yet
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Run a diagnostic to see it here
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px 20px' }}>
      <SectionLabel>Session history</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sessions.map(s => (
          <div key={s.session_id}
            onClick={() => onReopen(s.session_id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              background: 'var(--surface-1)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.server_name}
                </span>
                <Badge variant="dbms" dbms={s.dbms as any} size="sm">{s.dbms}</Badge>
                <Badge variant="mode" mode={s.mode as any} size="sm">{s.mode}</Badge>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {s.ticket_number} · {s.playbook_id}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {s.severity && <SeverityBadge severity={s.severity as any} />}
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
