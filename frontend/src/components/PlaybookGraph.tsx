import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface PlaybookStep {
  step_id: string;
  description: string;
  typical_next?: string[];
}

interface PlaybookData {
  id: string;
  title: string;
  entry_step: string;
  steps: Record<string, PlaybookStep>;
}

interface Props {
  playbookId: string | null;
  currentStep: string | null;
  stepsExecuted: string[];
  stepsSkipped: string[];
  isPendingApproval?: boolean;
  phase?: string;
}

export function PlaybookGraph({
  playbookId,
  currentStep,
  stepsExecuted,
  stepsSkipped,
  isPendingApproval = false,
  phase = 'idle',
}: Props) {
  const [playbook, setPlaybook] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playbookId) {
      setPlaybook(null);
      return;
    }

    setLoading(true);
    axios.get(`${BASE}/api/v1/playbooks/${playbookId}`)
      .then(r => {
        setPlaybook(r.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [playbookId]);

  if (!playbookId || loading) {
    return (
      <div style={{
        height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-1)', borderBottom: '1px solid var(--border)',
        color: 'var(--text-faint)', fontSize: 11
      }}>
        {loading ? 'Loading playbook graph...' : 'No active playbook'}
      </div>
    );
  }

  if (!playbook) return null;

  // Traverse the steps starting at the entry_step to order them logically (static fallback order)
  const staticOrder: string[] = [];
  const visited = new Set<string>();
  const queue = [playbook.entry_step];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    staticOrder.push(curr);

    const step = playbook.steps[curr];
    if (step && step.typical_next) {
      for (const next of step.typical_next) {
        if (next !== 'stop' && !next.startsWith('switch_to_') && !visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  // Dynamic ordering logic to rearrange step nodes based on DBA redirection
  const orderedStepIds: string[] = [];

  // 1. Append executed steps in order of actual execution
  stepsExecuted.forEach(stepId => {
    if (playbook.steps[stepId]) {
      orderedStepIds.push(stepId);
    }
  });

  // 2. Append current active step if not already executed
  if (currentStep && playbook.steps[currentStep] && !orderedStepIds.includes(currentStep)) {
    orderedStepIds.push(currentStep);
  }

  // 3. Append remaining steps from the static logical flow (excluding executed, current, and skipped)
  staticOrder.forEach(stepId => {
    if (!orderedStepIds.includes(stepId) && !stepsSkipped.includes(stepId)) {
      orderedStepIds.push(stepId);
    }
  });

  // 4. Append skipped steps at the end of the map
  staticOrder.forEach(stepId => {
    if (stepsSkipped.includes(stepId) && !orderedStepIds.includes(stepId)) {
      orderedStepIds.push(stepId);
    }
  });

  return (
    <div style={{
      background: 'var(--surface-1)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Playbook Diagnostic Flow Map
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', display: 'flex', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} /> Completed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} /> Active
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-mid)' }} /> Queued
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        overflowX: 'auto',
        padding: '4px 0',
      }}>
        {orderedStepIds.map((stepId, idx) => {
          const step = playbook.steps[stepId];
          const isComplete = stepsExecuted.includes(stepId);
          const isSessionComplete = phase === 'complete';
          const lastExecutedStep = stepsExecuted[stepsExecuted.length - 1];
          const isLastFinished = isComplete && lastExecutedStep === stepId && isSessionComplete;

          const isActive = currentStep === stepId && !isSessionComplete;
          const isSkipped = stepsSkipped.includes(stepId);

          if (!step) return null;

          return (
            <React.Fragment key={stepId}>
              {/* Node Card */}
              <div
                className={isActive && isPendingApproval ? 'node-pulse' : ''}
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-0)',
                  border: isLastFinished ? '3px solid' : '1.5px solid',
                  borderColor: isActive
                    ? 'var(--accent)'
                    : isLastFinished
                    ? 'var(--success)'
                    : isComplete
                    ? 'var(--success-border)'
                    : isSkipped
                    ? 'var(--border)'
                    : 'var(--border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: isActive ? 'var(--shadow)' : 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  minWidth: 150,
                  maxWidth: 220,
                  opacity: isSkipped ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isComplete ? (
                    <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 12, lineHeight: 1 }}>✓</span>
                  ) : isActive ? (
                    <div className={isPendingApproval ? 'node-pulse' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  ) : (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-faint)' }} />
                  )}
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: isActive ? 'var(--accent)' : isComplete ? 'var(--success)' : 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {stepId}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: isSkipped ? 'line-through' : 'none',
                  }}
                  title={step.description}
                >
                  {step.description}
                </div>
              </div>

              {/* Arrow Connector */}
              {idx < orderedStepIds.length - 1 && (
                <svg width="18" height="12" viewBox="0 0 24 12" fill="none" style={{ flexShrink: 0, opacity: isComplete ? 0.9 : 0.4 }}>
                  <path
                    d="M0 6H22M22 6L17 1M22 6L17 11"
                    stroke={isComplete ? 'var(--success)' : 'var(--border-mid)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
