// components/CheckpointApprovalPanel.tsx
import React, { useState } from 'react';
import { Button, Badge, SectionLabel } from './ui';
import type { SsePendingApproval, CheckpointDecisionRequest, DbaDecision } from '../types';

interface Props {
  pending: SsePendingApproval;
  onDecision: (decision: CheckpointDecisionRequest) => void;
  serverName: string;
  ticketNumber: string;
  maxSteps: number;
}

export function CheckpointApprovalPanel({
  pending, onDecision, serverName, ticketNumber, maxSteps,
}: Props) {
  const [showRedirect, setShowRedirect] = useState(false);
  const [selectedStep, setSelectedStep] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const rec = pending.claude_recommendation;

  const confidenceVariant = {
    high: 'success' as const,
    medium: 'warning' as const,
    low: 'danger' as const,
  }[rec.diagnosis_confidence];

  const handleApprove = () => {
    onDecision({ dba_decision: 'approved' });
  };

  const handleRedirect = () => {
    if (!selectedStep) return;
    onDecision({
      dba_decision: 'redirected',
      dba_selected_step: selectedStep,
      dba_override_reason: overrideReason || undefined,
    });
    setShowRedirect(false);
  };

  const handleStop = () => {
    onDecision({ dba_decision: 'stopped' });
  };

  // Keyboard: Enter = Approve
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !showRedirect && e.target === document.body) {
        handleApprove();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showRedirect]);

  return (
    <div className="fade-in" style={{
      margin: '16px 20px',
      border: '1px solid var(--accent-border)',
      borderTop: '2px solid var(--accent)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
      background: 'var(--surface-1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--accent-light)',
        borderBottom: '1px solid var(--accent-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)',
            boxShadow: '0 0 0 0 rgba(37,99,235,0.4)',
            animation: 'nodePulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Awaiting your decision
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            Checkpoint {pending.iteration} of {maxSteps}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {serverName} · {ticketNumber}
        </span>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>

        {/* Claude's summary — prominent */}
        <div style={{
          padding: '10px 13px',
          background: 'var(--accent-light)',
          border: '1px solid var(--accent-border)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
            Claude's finding
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {rec.interactive_summary || rec.assessment}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confidence</span>
            <Badge variant={confidenceVariant} size="sm">{rec.diagnosis_confidence}</Badge>
            {rec.skip_steps.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                · suggests skipping: {rec.skip_steps.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Technical detail — bullet points */}
        <div>
          <SectionLabel>Technical assessment</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {rec.assessment
              .split(/(?<=[.!?])\s+/)
              .filter((s: string) => s.trim().length > 0)
              .map((sentence: string, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0, marginTop: 1, fontFamily: 'var(--font-mono)' }}>›</span>
                  <span>{sentence.trim()}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Recommendation */}
        {rec.next_step && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          }}>
            <span style={{ fontSize: 18, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: 1, flexShrink: 0 }}>→</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Recommended next step
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                {rec.next_step}
              </div>
              {pending.available_steps[rec.next_step] && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {pending.available_steps[rec.next_step].hint}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>
                "{rec.rationale}"
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={handleApprove} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Approve
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              background: 'rgba(255,255,255,0.25)', padding: '1px 5px',
              borderRadius: 3,
            }}>↵</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowRedirect(!showRedirect)}
          >
            ⤴ Choose different step
          </Button>
          <Button variant="ghost" onClick={handleStop}>
            ■ Stop &amp; analyze
          </Button>
        </div>

        {/* Redirect panel */}
        {showRedirect && (
          <div className="fade-in" style={{
            padding: '12px 14px',
            background: 'var(--warning-light)',
            border: '1px solid var(--warning-border)',
            borderLeft: '2px solid var(--warning)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Redirect to a different step
            </div>
            <select
              value={selectedStep}
              onChange={e => setSelectedStep(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', marginBottom: 8,
                background: 'var(--surface-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 12,
                fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
              }}
            >
              <option value="">Select a step...</option>
              {Object.entries(pending.available_steps)
                .filter(([id]) => id !== rec.next_step)
                .map(([id, info]) => (
                  <option key={id} value={id}>{id} — {info.description}</option>
                ))}
            </select>
            <textarea
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Why are you redirecting? (helps improve playbook routing)"
              rows={2}
              style={{
                width: '100%', padding: '7px 10px', marginBottom: 8,
                background: 'var(--surface-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 12,
                fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
                resize: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 7 }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!selectedStep}
                onClick={handleRedirect}
              >
                Redirect to selected step
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowRedirect(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
