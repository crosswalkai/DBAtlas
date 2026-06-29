// components/InputForm.tsx
import React, { useState } from 'react';
import { Button, SectionLabel } from './ui';
import type { DiagnoseRequest, SessionMode, DbmsType } from '../types';

interface Props {
  onSubmit: (req: DiagnoseRequest) => void;
  loading?: boolean;
}

interface Scenario {
  label: string;
  question: string;
  server: string;
  ticket: string;
}

const SCENARIOS: Record<'sqlserver' | 'oracle', Scenario[]> = {
  sqlserver: [
    {
      label: "Plan Regression (SS-1)",
      question: "Our main catalog query is running extremely slow since last night's maintenance. Are we hitting a plan regression?",
      server: "SQLPROD-02",
      ticket: "INC8827162"
    },
    {
      label: "Deadlock Contention (SS-2)",
      question: "We are getting multiple deadlock errors (Error 1205) on the Orders table in SalesDB. Which session is the victim?",
      server: "SQLPROD-02",
      ticket: "INC0012052"
    },
    {
      label: "AG Replica Lag (SS-3)",
      question: "The DR replica is falling behind secondary redo queues. Redo is slow and RPO SLA is breached. What is the network throughput?",
      server: "SQLDR-01",
      ticket: "INC0021831"
    }
  ],
  oracle: [
    {
      label: "Live Slowness Triage",
      question: "Identify why the database is currently sluggish. What active sessions and wait classes are dominating?",
      server: "PRODDB-ORA-01",
      ticket: "INC0042871"
    },
    {
      label: "Top Resource Consumers",
      question: "Which SQL statements are consuming the most CPU time and buffer gets from v$sql right now?",
      server: "PRODDB-ORA-01",
      ticket: "INC0042872"
    },
    {
      label: "Historical AWR Forensics",
      question: "Reconstruct a database performance spike that occurred last night around 6 PM using AWR snapshots.",
      server: "PRODDB-ORA-01",
      ticket: "INC0042873"
    }
  ]
};

export function InputForm({ onSubmit, loading }: Props) {
  const [serverName, setServerName] = useState('PRODDB-ORA-01');
  const [ticketNumber, setTicketNumber] = useState('INC0042871');
  const [question, setQuestion] = useState('Troubleshoot what is slowing down this server right now');
  const [mode, setMode] = useState<SessionMode>('interactive');
  const [showManual, setShowManual] = useState(false);
  const [dbmsOverride, setDbmsOverride] = useState<DbmsType>('oracle');
  const [ticketError, setTicketError] = useState('');

  // Demo Assistant states
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantDbms, setAssistantDbms] = useState<'sqlserver' | 'oracle'>('sqlserver');
  const [selectedScenario, setSelectedScenario] = useState<number | ''>('');

  const validateTicket = (val: string) => {
    if (!/^(INC|CHG)\d{7}$/.test(val)) {
      setTicketError('Enter a valid ticket number (e.g. INC0042871 or CHG0001234)');
    } else {
      setTicketError('');
    }
  };

  const handleDbmsChange = (dbms: 'sqlserver' | 'oracle') => {
    setAssistantDbms(dbms);
    setSelectedScenario('');
  };

  const handleSelectScenario = (idxVal: string) => {
    if (idxVal === '') {
      setSelectedScenario('');
      return;
    }
    const idx = parseInt(idxVal, 10);
    setSelectedScenario(idx);
    const item = SCENARIOS[assistantDbms][idx];
    if (item) {
      setServerName(item.server);
      setTicketNumber(item.ticket);
      setQuestion(item.question);
      setTicketError('');
      setShowManual(false);
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
      gap: 32,
      flexDirection: 'row',
      flexWrap: 'wrap',
    }}>
      {/* Main input form */}
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

      {/* Demo Assistant Side Panel */}
      <div style={{
        width: '100%', maxWidth: 400,
        alignSelf: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        marginTop: 90, // align nicely with the form card
      }}>
        {/* Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAssistant(!showAssistant)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: 'var(--surface-1)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
            boxShadow: 'var(--shadow-sm)', width: '100%',
            transition: 'all 0.15s',
            marginBottom: 10,
            outline: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span>
            <span>Demo Assistant</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showAssistant ? '▲' : '▼'}</span>
        </button>

        {/* Collapsible Content */}
        {showAssistant && (
          <div
            className="fade-in"
            style={{
              background: 'var(--surface-1)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px 20px',
              boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Select a DBMS and diagnostic scenario to automatically populate the input form.
            </div>

            {/* Dropdowns row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <SectionLabel>DBMS</SectionLabel>
                <select
                  value={assistantDbms}
                  onChange={e => handleDbmsChange(e.target.value as any)}
                  style={{ ...inputStyle, color: 'var(--text-primary)', fontSize: 12 }}
                >
                  <option value="sqlserver">SQL Server</option>
                  <option value="oracle">Oracle</option>
                </select>
              </div>

              <div style={{ flex: 2 }}>
                <SectionLabel>Scenario Question</SectionLabel>
                <select
                  value={selectedScenario}
                  onChange={e => handleSelectScenario(e.target.value)}
                  style={{ ...inputStyle, color: 'var(--text-primary)', fontSize: 12 }}
                >
                  <option value="">-- Choose Scenario --</option>
                  {SCENARIOS[assistantDbms].map((sc, idx) => (
                    <option key={idx} value={idx}>{sc.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-filled indicator */}
            {selectedScenario !== '' && (
              <div
                className="fade-in"
                style={{
                  padding: '10px 12px', background: 'var(--warning-light)',
                  border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)',
                  fontSize: 11, color: 'var(--warning)', display: 'flex', flexDirection: 'column', gap: 4,
                  lineHeight: 1.4
                }}
              >
                <div style={{ fontWeight: 600 }}>⚡ Scenario Loaded:</div>
                <div style={{ fontSize: 10, opacity: 0.85 }}>
                  Server: <strong>{SCENARIOS[assistantDbms][Number(selectedScenario)].server}</strong><br />
                  Question: <em>"{SCENARIOS[assistantDbms][Number(selectedScenario)].question}"</em>
                </div>
              </div>
            )}
          </div>
        )}
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
  outline: 'none',
};
