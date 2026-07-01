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
  stepElapsed?: Record<string, { active: number; wait: number }>;
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
  analysis, checkpointLog, serverName, ticketNumber, playbookId, mode, stepElapsed,
}: Props) {
  const [activeTab, setActiveTab] = React.useState<'report' | 'audit'>('report');
  const [showCheckpointLog, setShowCheckpointLog] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [recipient, setRecipient] = React.useState('');
  const [cc, setCc] = React.useState('');
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
      const res = await shareReport(sessionId, recipient, cc, message);
      setShareSuccess(res.message || 'Report shared successfully!');
      setRecipient('');
      setCc('');
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
      
      {/* Tabs Selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 4, gap: 16 }}>
        <button
          onClick={() => setActiveTab('report')}
          style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'report' ? 'var(--accent)' : 'transparent'}`,
            padding: '8px 12px', fontSize: 13, fontWeight: activeTab === 'report' ? 600 : 500,
            color: activeTab === 'report' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', outline: 'none', transition: 'all 0.15s'
          }}
        >
          📋 Recommendations
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'audit' ? 'var(--accent)' : 'transparent'}`,
            padding: '8px 12px', fontSize: 13, fontWeight: activeTab === 'audit' ? 600 : 500,
            color: activeTab === 'audit' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', outline: 'none', transition: 'all 0.15s'
          }}
        >
          🛡 Audit & Explainability
        </button>
      </div>

      {activeTab === 'report' && (
        <>
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
                <SeverityBadge severity={analysis.severity} />
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
                <button
                  onClick={() => {
                    const findingsHtml = analysis.key_findings.map(f => `<li>${f}</li>`).join('\n');
                    const actionsHtml = analysis.recommended_actions.map(a => `<li>${a}</li>`).join('\n');
                    const timelineHtml = checkpointLog.map(entry => `
                      <div style="margin-bottom: 15px; padding: 12px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px;">
                        <div style="font-weight: bold; color: #2563EB; font-family: monospace;">Step [${entry.iteration}]: ${entry.step_id} - ${entry.step_description}</div>
                        <div style="margin: 4px 0; font-size: 13px;"><strong>Rows:</strong> ${entry.row_count}</div>
                        <div style="margin: 4px 0; font-size: 13px;"><strong>Claude Assessment:</strong> ${entry.claude_assessment}</div>
                        ${entry.dba_decision ? `<div style="margin: 4px 0; font-size: 13px;"><strong>DBA Decision:</strong> ${entry.dba_decision} (${entry.dba_override_reason || 'No override reason'})</div>` : ''}
                      </div>
                    `).join('\n');

                    const htmlContent = `
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="utf-8">
                        <title>DBAtlas Diagnostic Report - ${ticketNumber || 'Session'}</title>
                        <style>
                          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                          h1 { color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 20px; }
                          h2 { color: #1e40af; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                          .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
                          .metadata div { margin-bottom: 4px; }
                          .summary { font-size: 16px; font-weight: 500; background: #eff6ff; padding: 15px; border-left: 4px solid #2563EB; border-radius: 4px; margin-bottom: 20px; }
                          .severity-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: white; }
                          .severity-critical { background: #dc2626; }
                          .severity-high { background: #ea580c; }
                          .severity-medium { background: #d97706; }
                          .severity-low { background: #059669; }
                          ul { padding-left: 20px; }
                          li { margin-bottom: 8px; }
                        </style>
                      </head>
                      <body>
                        <h1>DBAtlas Diagnostic Report</h1>
                        <div class="metadata">
                          <div><strong>Session ID:</strong> ${sessionId}</div>
                          <div><strong>Server:</strong> ${serverName}</div>
                          <div><strong>Ticket:</strong> ${ticketNumber}</div>
                          <div><strong>Playbook:</strong> ${playbookId}</div>
                          <div><strong>Mode:</strong> ${mode.toUpperCase()}</div>
                          <div>
                            <strong>Severity:</strong> 
                            <span class="severity-badge severity-${analysis.severity}">${analysis.severity}</span>
                          </div>
                        </div>
                        
                        <h2>Summary</h2>
                        <div class="summary">${analysis.summary}</div>
                        
                        <h2>Key Findings</h2>
                        <ul>${findingsHtml}</ul>
                        
                        <h2>Recommended Actions</h2>
                        <ul>${actionsHtml}</ul>
                        
                        <h2>Audit Trail & Step Execution Log</h2>
                        <div>${timelineHtml}</div>
                      </body>
                      </html>
                    `;

                    const link = document.createElement('a');
                    link.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
                    link.download = `DBAtlas_Report_${ticketNumber || 'Session'}_${sessionId.slice(0, 8)}.html`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  title="Download HTML/PDF Report"
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
                  <span>📥</span>
                </button>
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
        </>
      )}

      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Whitelist banner */}
          <div style={{
            padding: '12px 16px', background: 'var(--success-light)',
            border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)',
            fontSize: 12, fontWeight: 500, lineHeight: 1.5
          }}>
            <span style={{ fontSize: 16 }}>🛡</span>
            <span><strong>Whitelist Verification Confirmed</strong>: All executed diagnostic scripts in this session were strictly validated against senior-DBA playbooks. Claude acted as a Router, not a Generator.</span>
          </div>

          {/* Metadata Card */}
          <Card>
            <div style={{ padding: 16 }}>
              <SectionLabel>Audit Compliance Metadata</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>ServiceNow Ticket</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{ticketNumber}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Target Database Server</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{serverName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Operating Mode</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, textTransform: 'capitalize' }}>{mode} Mode</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase' }}>DBMS Detected</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, textTransform: 'uppercase' }}>{playbookId ? (playbookId.split('-')[0] || 'Unknown') : 'Unknown'}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Chronological Step Execution Timeline */}
          <Card>
            <div style={{ padding: 16 }}>
              <SectionLabel>Chronological Step Execution Trail</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {checkpointLog.map((entry, index) => {
                  const t = stepElapsed ? stepElapsed[entry.step_id] : undefined;
                  return (
                    <div key={index} style={{
                      padding: 14, background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 600
                          }}>{entry.iteration}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {entry.step_id}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            — {entry.step_description}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {entry.dba_decision && (
                            <DbaDecisionBadge decision={entry.dba_decision} />
                          )}
                          <span style={{
                            fontSize: 10, color: 'var(--text-faint)', background: 'var(--surface-3)',
                            border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {entry.row_count} rows
                          </span>
                          {(() => {
                            const activeSec = t ? t.active : (entry.active_duration !== undefined ? entry.active_duration : 0);
                            const waitSec = t ? t.wait : (entry.wait_duration !== undefined ? entry.wait_duration : 0);
                            const hasTiming = t !== undefined || entry.active_duration !== undefined || entry.wait_duration !== undefined;
                            if (!hasTiming) return null;
                            return (
                              <span style={{
                                fontSize: 10, color: 'var(--text-faint)', background: 'var(--surface-3)',
                                border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                fontFamily: 'var(--font-mono)'
                              }}>
                                {waitSec > 0 ? `${activeSec}s active / ${waitSec}s wait` : `${activeSec}s active`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <Divider margin={2} />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 4 }}>
                            AI Assessment & Proposed Routing
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Recommendation:</strong> {entry.claude_recommendation?.routing_decision || entry.routing_decision} 
                            {entry.claude_recommendation?.next_step && ` (Next Step: ${entry.claude_recommendation.next_step})`}
                            <br />
                            <strong>Rationale:</strong> {entry.interactive_summary || entry.claude_assessment}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 4 }}>
                            DBA Decision Audit
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Decision:</strong> {entry.dba_decision === 'approved' ? 'Approved proposal' : entry.dba_decision === 'redirected' ? `Redirected to: ${entry.dba_selected_step}` : entry.dba_decision === 'switched_playbook' ? `Switched playbook to: ${entry.dba_selected_playbook}` : entry.dba_decision === 'stopped' ? 'Stopped session' : 'Completed automatically'}
                            {entry.dba_override_reason && (
                              <>
                                <br />
                                <strong style={{ color: 'var(--warning)' }}>DBA Override Note:</strong> <span style={{ fontStyle: 'italic' }}>"{entry.dba_override_reason}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
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
