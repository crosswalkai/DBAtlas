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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    axios.get(`${BASE}/api/v1/sessions`)
      .then(r => { setSessions(r.data.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredSessions = sessions.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.server_name.toLowerCase().includes(q) ||
      s.ticket_number.toLowerCase().includes(q) ||
      s.playbook_id.toLowerCase().includes(q)
    );
  });

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

      {/* Search Input */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <input
          type="text"
          placeholder="Filter sessions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px 7px 30px',
            fontSize: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <span style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-faint)',
          pointerEvents: 'none',
          fontSize: 13
        }}>🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              fontSize: 12,
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredSessions.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No sessions match "{searchQuery}"
          </div>
        ) : (
          filteredSessions.map(s => (
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
          ))
        )}
      </div>
    </div>
  );
}
