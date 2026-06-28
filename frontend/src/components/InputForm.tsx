// components/InputForm.tsx
import React, { useState } from 'react';
import { Button, SectionLabel } from './ui';
import type { DiagnoseRequest, SessionMode, DbmsType } from '../types';

interface Props {
  onSubmit: (req: DiagnoseRequest) => void;
  loading?: boolean;
}

export function InputForm({ onSubmit, loading }: Props) {
  const [serverName, setServerName] = useState('PRODDB-ORA-01');
  const [ticketNumber, setTicketNumber] = useState('INC0042871');
  const [question, setQuestion] = useState('Troubleshoot what is slowing down this server right now');
  const [mode, setMode] = useState<SessionMode>('interactive');
  const [showManual, setShowManual] = useState(false);
  const [dbmsOverride, setDbmsOverride] = useState<DbmsType>('oracle');
  const [ticketError, setTicketError] = useState('');

  const validateTicket = (val: string) => {
    if (!/^(INC|CHG)\d{7}$/.test(val)) {
      setTicketError('Enter a valid ticket number (e.g. INC0042871 or CHG0001234)');
    } else {
      setTicketError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketError || !ticketNumber || !serverName || !question) return;
    onSubmit({
      server_name: serverName,
      ticket_number: ticketNumber,
      question,
      mode,
      use_mock_data: true,
      ...(showManual ? { dbms_type_override: dbmsOverride } : {}),
    });
  };

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 32,
      background: 'var(--surface-0)',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ marginBottom: 10 }}>
            <img
              src="/DBAtlas-horizontal.svg"
              alt="DBAtlas"
              style={{ height: 52, width: 'auto' }}
            />
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.02em', marginBottom: 14 }}>
            <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>D</span>ata<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>b</span>ase <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>A</span>gentic <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>T</span>roub<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>l</span>eshooting <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>A</span>dvi<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>s</span>or
          </div>
          <h1 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            New diagnostic session
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Describe the issue in plain language — AI will navigate the diagnostic
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Row 1: Server + Ticket */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <SectionLabel>Server name</SectionLabel>
                  <input
                    value={serverName}
                    onChange={e => setServerName(e.target.value)}
                    placeholder="e.g. PRODDB-ORA-01"
                    required
                    style={inputStyle}
                    onBlur={() => {
                      // In production: check server registry here
                      // For local dev, show manual fields if not a known name
                      setShowManual(!serverName.toUpperCase().includes('ORA') &&
                        !serverName.toUpperCase().includes('SQL') &&
                        !serverName.toUpperCase().includes('PG') &&
                        !serverName.toUpperCase().includes('MG'));
                    }}
                  />
                </div>
                <div>
                  <SectionLabel>ServiceNow ticket</SectionLabel>
                  <input
                    value={ticketNumber}
                    onChange={e => { setTicketNumber(e.target.value); setTicketError(''); }}
                    onBlur={e => validateTicket(e.target.value)}
                    placeholder="e.g. INC0042871"
                    required
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)', ...(ticketError ? { borderColor: 'var(--danger)' } : {}) }}
                  />
                  {ticketError && (
                    <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                      {ticketError}
                    </div>
                  )}
                </div>
              </div>

              {/* Manual DBMS fallback */}
              {showManual && (
                <div style={{
                  padding: '10px 12px', background: 'var(--warning-light)',
                  border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)',
                  fontSize: 12, color: 'var(--warning)',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Server not in registry — enter details manually
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                    <div>
                      <SectionLabel>DBMS type</SectionLabel>
                      <select
                        value={dbmsOverride}
                        onChange={e => setDbmsOverride(e.target.value as DbmsType)}
                        style={{ ...inputStyle, color: 'var(--text-primary)' }}
                      >
                        <option value="oracle">Oracle</option>
                        <option value="sqlserver">SQL Server</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mongodb">MongoDB</option>
                      </select>
                    </div>
                    <div>
                      <SectionLabel>Connection string</SectionLabel>
                      <input placeholder="e.g. oracle+cx_oracle://user:pass@host/db" style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}

              {/* Question */}
              <div>
                <SectionLabel>Diagnostic question</SectionLabel>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Describe the issue in plain language..."
                  rows={3}
                  required
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                />
              </div>

              {/* Mode toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                    Operating mode
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {mode === 'interactive'
                      ? 'You approve each step before it runs'
                      : 'Claude runs the full diagnostic automatically'}
                  </div>
                </div>
                <div style={{
                  display: 'flex', background: 'var(--surface-1)',
                  border: '1px solid var(--border)', borderRadius: 20, padding: 3, gap: 2,
                }}>
                  {(['auto', 'interactive'] as SessionMode[]).map(m => (
                    <button
                      key={m} type="button"
                      title={m === 'auto' ? "I'm feeling lucky!" : "I'm in charge!"}
                      onClick={() => setMode(m)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '4px 14px',
                        borderRadius: 16, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        background: mode === m ? '#FFF0E6' : 'transparent',
                        color: mode === m ? '#C2540A' : 'var(--text-muted)',
                        border: mode === m ? '1px solid #F9C4A0' : '1px solid transparent',
                        transition: 'all 0.15s',
                        textTransform: 'capitalize',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                loading={loading}
                disabled={!!ticketError || !serverName || !ticketNumber || !question}
                style={{
                  width: '100%', justifyContent: 'center', padding: '10px',
                  background: '#F3F4F6',
                  color: '#C2540A',
                  borderColor: '#E5E7EB',
                }}
              >
                {loading ? 'Starting...' : '▶  Run diagnostic'}
              </Button>

            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'var(--text-faint)' }}>
          Running against mock data · Auth disabled · Local dev mode
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: 'var(--surface-0)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  transition: 'border-color 0.15s',
};
