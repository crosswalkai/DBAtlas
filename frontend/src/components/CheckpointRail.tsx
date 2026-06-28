// components/CheckpointRail.tsx
import React from 'react';
import { SectionLabel, Divider, Badge } from './ui';
import type { CheckpointNode, DbmsType, SessionMode } from '../types';

interface Props {
  nodes: CheckpointNode[];
  playbookId: string | null;
  playbookTitle: string | null;
  dbms: DbmsType | null;
  mode: SessionMode;
  stepsSkipped: string[];
  currentIteration: number;
  maxSteps?: number;
}

export function CheckpointRail({
  nodes, playbookId, playbookTitle, dbms, mode,
  stepsSkipped, currentIteration, maxSteps = 5,
}: Props) {
  const complete = nodes.filter(n => n.state === 'complete').length;
  const progressPct = maxSteps > 0 ? Math.min((complete / maxSteps) * 100, 100) : 0;

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      background: 'var(--surface-1)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: 16, overflowY: 'auto',
    }}>
      <SectionLabel>Checkpoint rail</SectionLabel>

      {/* Playbook card */}
      {playbookId && (
        <div style={{
          padding: '9px 11px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>
            Active playbook
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {playbookId}
          </div>
          {playbookTitle && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{playbookTitle}</div>
          )}
        </div>
      )}

      {/* Progress */}
      <div style={{
        padding: '9px 11px', background: 'var(--surface-2)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 7 }}>
          Session progress
        </div>
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
          <div style={{
            height: 3, borderRadius: 2,
            background: 'linear-gradient(90deg, var(--accent), #60A5FA)',
            width: `${progressPct}%`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {complete} of {maxSteps} steps · {mode}
        </div>
      </div>

      <Divider margin={4} />

      {/* Nodes */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {nodes.map((node, i) => (
          <NodeRow key={node.step_id} node={node} isLast={i === nodes.length - 1} />
        ))}

        {/* Placeholder nodes for remaining steps */}
        {nodes.length < maxSteps && Array.from({ length: maxSteps - nodes.length }).map((_, i) => (
          <PlaceholderNode key={`ph-${i}`} num={nodes.length + i + 1} isLast={i === maxSteps - nodes.length - 1} />
        ))}
      </div>

      {/* Skipped steps */}
      {stepsSkipped.length > 0 && (
        <>
          <Divider margin={10} />
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            Skipped
          </div>
          {stepsSkipped.map(s => (
            <div key={s} style={{ marginBottom: 4 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--text-faint)', textDecoration: 'line-through',
              }}>
                {s}
              </div>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

function NodeRow({ node, isLast }: { node: CheckpointNode; isLast: boolean }) {
  const isActive = node.state === 'active';
  const isDone = node.state === 'complete';

  return (
    <div style={{ display: 'flex', gap: 9, position: 'relative' }}>
      {/* Vertical line */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 8, top: 20, bottom: 0,
          width: 1, background: 'var(--border)',
        }} />
      )}

      {/* Circle */}
      <div style={{ flexShrink: 0, zIndex: 1 }}>
        <div
          className={isActive ? 'node-pulse' : ''}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
            ...(isDone ? {
              background: 'var(--success-light)', border: '1px solid var(--success-border)',
              color: 'var(--success)',
            } : isActive ? {
              background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
              color: 'var(--accent)',
            } : {
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-faint)',
            }),
          }}
        >
          {isDone ? '✓' : node.iteration}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: isActive ? 'var(--accent)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)',
          marginBottom: 2,
        }}>
          {node.step_id}
        </div>
        <div style={{ fontSize: 10, color: isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--text-faint)' }}>
          {isActive ? 'Awaiting approval' : isDone ? 'Complete' : 'Queued'}
        </div>
        {isDone && node.dba_decision && (
          <div style={{ marginTop: 3 }}>
            <Badge variant={node.dba_decision === 'approved' ? 'success' : 'warning'} size="sm">
              {node.dba_decision === 'approved' ? '✓ Approved' : '⤴ Redirected'}
            </Badge>
          </div>
        )}
        {node.row_count !== undefined && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>
            {node.row_count} rows
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderNode({ num, isLast }: { num: number; isLast: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 9, position: 'relative' }}>
      {!isLast && (
        <div style={{
          position: 'absolute', left: 8, top: 20, bottom: 0,
          width: 1, background: 'var(--border)',
        }} />
      )}
      <div style={{ flexShrink: 0, zIndex: 1 }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          color: 'var(--text-faint)',
        }}>
          {num}
        </div>
      </div>
      <div style={{ flex: 1, paddingBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
          — not yet determined
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>Queued</div>
      </div>
    </div>
  );
}
