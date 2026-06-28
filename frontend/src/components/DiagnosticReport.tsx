// components/DiagnosticReport.tsx
import React from 'react';
import { SeverityBadge, SectionLabel, Card, DbaDecisionBadge, Divider } from './ui';
import type { FinalAnalysis, CheckpointLogEntry } from '../types';

interface Props {
  analysis: FinalAnalysis;
  checkpointLog: CheckpointLogEntry[];
  serverName: string;
  ticketNumber: string;
  playbookId: string | null;
  mode: string;
}

export function DiagnosticReport({
  analysis, checkpointLog, serverName, ticketNumber, playbookId, mode,
}: Props) {
  const [showCheckpointLog, setShowCheckpointLog] = React.useState(false);

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
          <SeverityBadge severity={analysis.severity} />
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
          <SectionLabel>Key findings</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {analysis.key_findings.map((finding, i) => (
              <div key={i} style={{
                padding: '9px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--accent)',
                borderRadius: 'var(--radius)',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                  Finding {i + 1}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {finding}
                </div>
              </div>
            ))}
          </div>

          {/* Recommended actions */}
          <SectionLabel>Recommended actions</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {analysis.recommended_actions.map((action, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 12px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', alignItems: 'flex-start',
              }}>
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
                    {entry.dba_decision && (
                      <DbaDecisionBadge decision={entry.dba_decision} />
                    )}
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
    </div>
  );
}
