// App.tsx — main application shell
import React from 'react';
import { useSession } from './hooks/useSession';
import { InputForm } from './components/InputForm';
import { CheckpointRail } from './components/CheckpointRail';
import { CheckpointApprovalPanel } from './components/CheckpointApprovalPanel';
import { DiagnosticReport } from './components/DiagnosticReport';
import { Badge, Spinner, SeverityBadge } from './components/ui';

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    classifying: 'Classifying intent...',
    executing: 'Running step...',
    evaluating: 'Claude evaluating...',
    pending_approval: 'Awaiting your decision',
    analyzing: 'Generating analysis...',
  };
  return map[phase] || phase;
}

export default function App() {
  const { state, run, submitDecision, reset } = useSession();
  const { phase } = state;
  const isIdle = phase === 'idle';
  const isRunning = ['classifying','executing','evaluating','pending_approval','analyzing'].includes(phase);
  const isComplete = phase === 'complete';
  const isError = phase === 'error';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Topbar */}
      {!isIdle && (
        <header style={{
          height: 44, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 18px', background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
              DbAxis · DBA Copilot
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 8px', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
            {state.serverName}
          </div>
          {state.dbms && <Badge variant="dbms" dbms={state.dbms}>{state.dbms}</Badge>}
          <div style={{
            padding: '2px 8px', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
          }}>
            {state.ticketNumber}
          </div>
          <Badge variant="mode" mode={state.mode}>
            {state.mode === 'interactive' ? '● Interactive' : '▶ Auto'}
          </Badge>
          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
              <Spinner size={12} />
              <span>{phaseLabel(phase)}</span>
            </div>
          )}
          {isComplete && state.analysis && <SeverityBadge severity={state.analysis.severity} />}
          <div style={{ flex: 1 }} />
          <button onClick={reset} style={{
            fontSize: 12, fontWeight: 500, padding: '4px 12px',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
          }}>
            + New session
          </button>
        </header>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {isIdle && <InputForm onSubmit={run} />}

        {!isIdle && (
          <>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Question bar */}
              <div style={{
                padding: '11px 20px', background: 'var(--surface-2)',
                borderBottom: '1px solid var(--border)', flexShrink: 0,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  Diagnostic question
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  "{state.question}"
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                  {state.intentCategory && (
                    <Badge variant="purple" size="sm">{state.intentCategory.replace('_', ' ')}</Badge>
                  )}
                  {state.playbookId && (
                    <Badge variant="default" size="sm">{state.playbookId}</Badge>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Spinner states */}
                {(phase === 'classifying' || phase === 'analyzing') && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 14 }}>
                    <Spinner size={28} />
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {phase === 'classifying' ? 'Classifying intent and selecting playbook...' : 'Generating final analysis...'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Claude is working</div>
                  </div>
                )}

                {/* Executing */}
                {(phase === 'executing' || phase === 'evaluating') && state.currentStep && (
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      padding: '14px 16px', background: 'var(--surface-1)',
                      border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Spinner size={13} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {phase === 'executing' ? 'Executing step' : 'Evaluating results'}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {state.currentStep}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Checkpoint {state.currentIteration} · {state.mode} mode
                      </div>
                    </div>
                    {state.mode === 'auto' && (
                      <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)' }}>
                        Auto mode — Claude navigating automatically. Steps: {state.stepsExecuted.join(', ') || '—'}
                      </div>
                    )}
                  </div>
                )}

                {/* Pending approval */}
                {phase === 'pending_approval' && state.pendingApproval && (
                  <CheckpointApprovalPanel
                    pending={state.pendingApproval}
                    onDecision={submitDecision}
                    serverName={state.serverName}
                    ticketNumber={state.ticketNumber}
                    maxSteps={5}
                  />
                )}

                {/* Completed steps shown below approval panel */}
                {phase === 'pending_approval' && state.checkpointLog.length > 0 && (
                  <div style={{ padding: '0 20px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 9 }}>
                      Steps completed this session
                    </div>
                    {state.checkpointLog.map((entry, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 10, padding: '8px 11px', marginBottom: 6,
                        background: 'var(--surface-1)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', opacity: 0.8, alignItems: 'flex-start',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--success-light)', border: '1px solid var(--success-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 600, color: 'var(--success)',
                        }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.step_id}</div>
                          <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2 }}>✓ {entry.dba_decision === 'approved' ? 'Approved' : entry.dba_decision}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>{entry.row_count} rows</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final report */}
                {isComplete && state.analysis && (
                  <DiagnosticReport
                    analysis={state.analysis}
                    checkpointLog={state.checkpointLog}
                    serverName={state.serverName}
                    ticketNumber={state.ticketNumber}
                    playbookId={state.playbookId}
                    mode={state.mode}
                  />
                )}

                {/* Error */}
                {isError && (
                  <div style={{ padding: 24 }}>
                    <div style={{
                      padding: 16, background: 'var(--danger-light)',
                      border: '1px solid var(--danger-border)',
                      borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 6, fontSize: 14 }}>Session error</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{state.errorMessage}</div>
                      <button onClick={reset} style={{
                        fontSize: 12, fontWeight: 500, padding: '6px 14px',
                        background: 'var(--danger)', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                      }}>Start new session</button>
                    </div>
                  </div>
                )}

              </div>
            </main>

            <CheckpointRail
              nodes={state.nodes}
              playbookId={state.playbookId}
              playbookTitle={state.playbookTitle}
              dbms={state.dbms}
              mode={state.mode}
              stepsSkipped={state.stepsSkipped}
              currentIteration={state.currentIteration}
              maxSteps={5}
            />
          </>
        )}
      </div>
    </div>
  );
}
