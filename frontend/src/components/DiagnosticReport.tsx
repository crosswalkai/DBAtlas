// components/DiagnosticReport.tsx
import React from 'react';
import { SeverityBadge, SectionLabel, Card, DbaDecisionBadge, Divider } from './ui';
import type { FinalAnalysis, CheckpointLogEntry } from '../types';
import { shareReport } from '../api/client';

interface Props {
  sessionId: string;
  analysis: FinalAnalysis;
  checkpointLog: CheckpointLogEntry[];
  serverName: string;
  ticketNumber: string;
  playbookId: string | null;
  mode: string;
}

function CopySmallButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy to clipboard"
      style={{
        fontSize: 11, padding: '3px 8px',
        background: copied ? 'var(--success-light)' : 'var(--surface-2)',
        border: `1px solid ${copied ? 'var(--success-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
        outline: 'none',
      }}
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

function CopyAllButton({ texts, label = "Copy All" }: { texts: string[]; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copyAll = () => {
    const text = texts.map((t, i) => `${i + 1}. ${t}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copyAll}
      style={{
        fontSize: 11, padding: '3px 8px',
        background: copied ? 'var(--success-light)' : 'var(--surface-2)',
        border: `1px solid ${copied ? 'var(--success-border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        color: copied ? 'var(--success)' : 'var(--text-muted)',
        fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
        outline: 'none',
      }}
    >
      {copied ? '✓ Copied' : `⧉ ${label}`}
    </button>
  );
}

export function DiagnosticReport({
  sessionId,
  analysis, checkpointLog, serverName, ticketNumber, playbookId, mode,
}: Props) {
  const [showCheckpointLog, setShowCheckpointLog] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [recipient, setRecipient] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [sharing, setSharing] = React.useState(false);
  const [shareSuccess, setShareSuccess] = React.useState('');
  const [shareError, setShareError] = React.useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowShareModal(false);
        setShareError('');
        setShareSuccess('');
      }
    };
    if (showShareModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShareModal]);

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient) return;
    setSharing(true);
    setShareSuccess('');
    setShareError('');
    try {
      const res = await shareReport(sessionId, recipient, message);
      setShareSuccess(res.message || 'Report shared successfully!');
      setRecipient('');
      setMessage('');
      setTimeout(() => {
        setShowShareModal(false);
        setShareSuccess('');
      }, 2000);
    } catch (err: any) {
      setShareError(err.response?.data?.detail || 'Failed to share report. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Analysis card */}
      <Card accentColor="var(--accent)">
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {playbookId || 'diagnostic'} · {mode} mode
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                fontSize: 11, padding: '3px 8px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 4,
                outline: 'none',
              }}
            >
              <span>✉</span>
              <span>Share Report</span>
            </button>
            <SeverityBadge severity={analysis.severity} />
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Summary */}
          <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 16 }}>
            {analysis.summary}
          </div>

          <div style={{
            fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic',
            marginBottom: 14, padding: '6px 10px',
            background: 'var(--surface-2)', borderRadius: 'var(--radius)',
          }}>
            Severity rationale: {analysis.severity_rationale}
          </div>

          {/* Key findings */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionLabel>Key findings</SectionLabel>
            <CopyAllButton texts={analysis.key_findings} label="Copy All Findings" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {analysis.key_findings.map((finding, i) => (
              <div key={i} style={{
                padding: '9px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--accent)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Finding {i + 1}
                  </div>
                  <CopySmallButton text={finding} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {finding}
                </div>
              </div>
            ))}
          </div>

          {/* Recommended actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionLabel>Recommended actions</SectionLabel>
            <CopyAllButton texts={analysis.recommended_actions} label="Copy All Actions" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {analysis.recommended_actions.map((action, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 12px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                    color: 'var(--accent)', width: 18, flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {action}
                  </span>
                </div>
                <div style={{ marginLeft: 8 }}>
                  <CopySmallButton text={`${i + 1}. ${action}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Steps summary */}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Steps executed: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{analysis.steps_executed.join(', ')}</strong></span>
            {analysis.steps_skipped.length > 0 && (
              <span>Skipped: <strong style={{ fontFamily: 'var(--font-mono)', textDecoration: 'line-through' }}>{analysis.steps_skipped.join(', ')}</strong></span>
            )}
          </div>
        </div>
      </Card>

      {/* Checkpoint log — collapsible */}
      {checkpointLog.length > 0 && (
        <Card>
          <button
            onClick={() => setShowCheckpointLog(v => !v)}
            style={{
              width: '100%', padding: '10px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            <span>Checkpoint decision log ({checkpointLog.length} steps)</span>
            <span>{showCheckpointLog ? '▲' : '▼'}</span>
          </button>
          {showCheckpointLog && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                <CopyAllButton texts={checkpointLog.map(entry => 
                  `Step: ${entry.step_id} (${entry.row_count} rows)\n` +
                  `Assessment: ${entry.interactive_summary || entry.claude_assessment}` +
                  (entry.dba_override_reason ? `\nDBA note: "${entry.dba_override_reason}"` : '')
                )} label="Copy All Log Entries" />
              </div>
              {checkpointLog.map((entry, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                        color: 'var(--accent)',
                      }}>
                        {entry.step_id}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                        {entry.row_count} rows
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {entry.dba_decision && (
                        <DbaDecisionBadge decision={entry.dba_decision} />
                      )}
                      <CopySmallButton text={
                        `Step: ${entry.step_id} (${entry.row_count} rows)\n` +
                        `Assessment: ${entry.interactive_summary || entry.claude_assessment}` +
                        (entry.dba_override_reason ? `\nDBA note: "${entry.dba_override_reason}"` : '')
                      } />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {entry.interactive_summary || entry.claude_assessment}
                  </div>
                  {entry.dba_override_reason && (
                    <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 5, fontStyle: 'italic' }}>
                      DBA note: "{entry.dba_override_reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
          }}>
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
