// SessionHistory.tsx
import React, { useState, useEffect } from 'react';
import { getSession, shareReport } from '../api/client';
import { Badge, SeverityBadge, SectionLabel } from './ui';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

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
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Email Sharing states
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [cc, setCc] = useState('');
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState('');
  const [shareError, setShareError] = useState('');

  // Handle ESC key to close share modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShareModal(false);
        setShareError('');
        setShareSuccess('');
        setSelectedSessionId(null);
      }
    };
    if (showShareModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShareModal]);

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !recipient) return;
    setSharing(true);
    setShareSuccess('');
    setShareError('');
    try {
      const res = await shareReport(selectedSessionId, recipient, cc, message);
      setShareSuccess(res.message || 'Report shared successfully!');
      setRecipient('');
      setCc('');
      setMessage('');
      setTimeout(() => {
        setShowShareModal(false);
        setShareSuccess('');
        setSelectedSessionId(null);
      }, 2000);
    } catch (err: any) {
      setShareError(err.response?.data?.detail || 'Failed to share report. Please try again.');
    } finally {
      setSharing(false);
    }
  };

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

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const tA = new Date(a.created_at).getTime();
    const tB = new Date(b.created_at).getTime();
    return sortDirection === 'desc' ? tB - tA : tA - tB;
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

      {/* Search & Sort Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: 'relative' }}>
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

        <button
          onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
          title={`Sort by time: ${sortDirection === 'desc' ? 'Newest First' : 'Oldest First'}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', background: 'var(--surface-1)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            cursor: 'pointer', color: 'var(--text-primary)', fontSize: 12,
            fontWeight: 500, outline: 'none', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <span>⏱️</span>
          <span>{sortDirection === 'desc' ? 'Newest First' : 'Oldest First'}</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sortedSessions.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No sessions match "{searchQuery}"
          </div>
        ) : (
          sortedSessions.map(s => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {s.severity && <SeverityBadge severity={s.severity as any} />}
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'right' }}>
                  {new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                </div>
                
                {/* Share Email Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent opening/reopening the session
                    setSelectedSessionId(s.session_id);
                    setShowShareModal(true);
                  }}
                  title="Share Report"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, color: 'var(--text-muted)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '4px',
                    borderRadius: 'var(--radius-sm)', transition: 'all 0.15s',
                    outline: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                >
                  ✉
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Share Report Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
            width: '90%', maxWidth: 450, overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '14px 18px', background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                ✉ Share Diagnostic Report
              </span>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setShareError('');
                  setShareSuccess('');
                  setSelectedSessionId(null);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--text-muted)', fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleShareSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <SectionLabel>Recipient Email</SectionLabel>
                <input
                  type="email"
                  required
                  placeholder="e.g. triagedev@company.com"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--surface-0)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <SectionLabel>CC (Optional)</SectionLabel>
                <input
                  type="text"
                  placeholder="e.g. lead-dba@company.com, pagerduty@company.com"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--surface-0)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <SectionLabel>Custom Message / Triage Notes (Optional)</SectionLabel>
                <textarea
                  placeholder="Add any additional notes about this diagnostic report..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--surface-0)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-sans)',
                    outline: 'none', resize: 'none', lineHeight: 1.5,
                  }}
                />
              </div>

              {shareSuccess && (
                <div style={{
                  padding: '8px 12px', background: 'var(--success-light)',
                  border: '1px solid var(--success-border)', borderRadius: 'var(--radius)',
                  color: 'var(--success)', fontSize: 12, fontWeight: 500,
                }}>
                  ✓ {shareSuccess}
                </div>
              )}

              {shareError && (
                <div style={{
                  padding: '8px 12px', background: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)',
                  color: 'var(--danger)', fontSize: 12, fontWeight: 500,
                }}>
                  ⚠ {shareError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowShareModal(false);
                    setShareError('');
                    setShareSuccess('');
                    setSelectedSessionId(null);
                  }}
                  style={{
                    fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sharing || !!shareSuccess}
                  style={{
                    fontSize: 12, padding: '6px 14px', borderRadius: 'var(--radius)',
                    background: 'var(--accent)', border: '1px solid var(--accent)',
                    color: '#FFF', cursor: sharing || shareSuccess ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)', fontWeight: 500,
                    opacity: sharing || shareSuccess ? 0.7 : 1,
                  }}
                >
                  {sharing ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
