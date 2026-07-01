// hooks/useSession.ts
import { useState, useCallback, useRef } from 'react';
import {
  startDiagnose, openSseStream,
  submitCheckpointDecision, getSession, stopSession,
} from '../api/client';
import type {
  DiagnoseRequest, SessionMode, SessionState,
  CheckpointNode, FinalAnalysis, CheckpointLogEntry,
  SsePendingApproval, SseCheckpointEvaluated,
  DbmsType, IntentCategory, DbaDecision,
  CheckpointDecisionRequest,
} from '../types';

export type DiagnosticPhase =
  | 'idle'
  | 'classifying'
  | 'executing'
  | 'evaluating'
  | 'pending_approval'
  | 'analyzing'
  | 'complete'
  | 'error';

export interface SessionState2 {
  sessionId: string | null;
  phase: DiagnosticPhase;
  mode: SessionMode;
  dbms: DbmsType | null;
  playbookId: string | null;
  playbookTitle: string | null;
  intentCategory: IntentCategory | null;
  currentStep: string | null;
  currentIteration: number;
  nodes: CheckpointNode[];
  pendingApproval: SsePendingApproval | null;
  lastEvaluation: SseCheckpointEvaluated | null;
  analysis: FinalAnalysis | null;
  checkpointLog: CheckpointLogEntry[];
  errorMessage: string | null;
  stepsExecuted: string[];
  stepsSkipped: string[];
  serverName: string;
  ticketNumber: string;
  question: string;
  created_at: string; // ISO timestamp of session creation
}

const initialState: SessionState2 = {
  sessionId: null,
  phase: 'idle',
  mode: 'auto',
  dbms: null,
  playbookId: null,
  playbookTitle: null,
  intentCategory: null,
  currentStep: null,
  currentIteration: 0,
  nodes: [],
  pendingApproval: null,
  lastEvaluation: null,
  analysis: null,
  checkpointLog: [],
  errorMessage: null,
  stepsExecuted: [],
  stepsSkipped: [],
  serverName: '',
  ticketNumber: '',
  question: '',
  created_at: '', // will be populated from backend
};

export function useSession() {
  const [state, setState] = useState<SessionState2>(initialState);
  const esSrcRef = useRef<EventSource | null>(null);

  const updateState = useCallback((patch: Partial<SessionState2>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const run = useCallback(async (req: DiagnoseRequest) => {
    // Reset
    setState({
      ...initialState,
      phase: 'classifying',
      mode: req.mode,
      serverName: req.server_name,
      ticketNumber: req.ticket_number,
      question: req.question,
    });

    const { session_id } = await startDiagnose(req);
    updateState({ sessionId: session_id });

    let isCompleteReceived = false;
    const es = openSseStream(session_id);
    esSrcRef.current = es;

    es.addEventListener('session_started', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      updateState({
        dbms: d.detected_dbms,
        playbookId: d.playbook_id,
        playbookTitle: d.playbook_title,
        intentCategory: d.intent_category,
        phase: 'executing',
        created_at: d.created_at || new Date().toISOString(),
      });
    });

    es.addEventListener('step_executing', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      updateState({
        phase: 'executing',
        currentStep: d.step_id,
        currentIteration: d.iteration,
      });
      setState(prev => ({
        ...prev,
        nodes: upsertNode(prev.nodes, {
          iteration: d.iteration,
          step_id: d.step_id,
          step_description: d.step_description,
          state: 'active',
        }),
      }));
    });

    es.addEventListener('step_complete', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        stepsExecuted: [...prev.stepsExecuted, d.step_id],
        nodes: upsertNode(prev.nodes, {
          iteration: d.iteration,
          step_id: d.step_id,
          step_description: prev.nodes.find(n => n.step_id === d.step_id)?.step_description || d.step_id,
          state: 'active',
          row_count: d.row_count,
        }),
      }));
    });

    es.addEventListener('checkpoint_evaluated', (e: MessageEvent) => {
      const d: SseCheckpointEvaluated = JSON.parse(e.data);
      updateState({ phase: 'evaluating', lastEvaluation: d });
    });

    es.addEventListener('pending_approval', (e: MessageEvent) => {
      const d: SsePendingApproval = JSON.parse(e.data);
      updateState({ phase: 'pending_approval', pendingApproval: d });
    });

    es.addEventListener('max_steps_warning', (e: MessageEvent) => {
      // handled in component via lastEvaluation
    });

    es.addEventListener('analyzing', (e: MessageEvent) => {
      updateState({ phase: 'analyzing', pendingApproval: null });
      // Mark active node as complete
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.state === 'active' ? { ...n, state: 'complete' } : n
        ),
      }));
    });

    es.addEventListener('complete', async (e: MessageEvent) => {
      isCompleteReceived = true;
      es.close();
      const d = JSON.parse(e.data);
      // Fetch full session to get analysis
      try {
        const session = await getSession(session_id);
        setState(prev => ({
          ...prev,
          phase: 'complete',
          analysis: session.analysis || null,
          checkpointLog: session.checkpoint_log,
          stepsSkipped: session.steps_skipped,
          nodes: prev.nodes.map(n => n.state === 'active' ? { ...n, state: 'complete' } : n),
        }));
      } catch {
        updateState({ phase: 'complete' });
      }
    });

    es.addEventListener('error', (e: MessageEvent) => {
      try {
        const d = JSON.parse((e as any).data || '{}');
        updateState({
          phase: 'error',
          errorMessage: d.message || 'An unexpected error occurred.',
        });
      } catch {
        updateState({ phase: 'error', errorMessage: 'Connection error.' });
      }
      es.close();
    });

    es.onerror = () => {
      if (isCompleteReceived) return;
      // EventSource network error — only flag if not already complete
      setState(prev => {
        if (prev.phase === 'complete') return prev;
        return { ...prev, phase: 'error', errorMessage: 'Lost connection to server.' };
      });
    };
  }, [updateState]);

  const submitDecision = useCallback(async (
    decision: CheckpointDecisionRequest,
  ) => {
    if (!state.sessionId || !state.pendingApproval) return;
    const iteration = state.pendingApproval.iteration;

    // Optimistically update node
    setState(prev => ({
      ...prev,
      phase: 'executing',
      pendingApproval: null,
      nodes: upsertNode(prev.nodes, {
        iteration: prev.currentIteration,
        step_id: prev.currentStep || '',
        step_description: prev.nodes.find(n => n.step_id === prev.currentStep)?.step_description || '',
        state: 'complete',
        dba_decision: decision.dba_decision,
      }),
    }));

    await submitCheckpointDecision(state.sessionId, iteration, decision);
  }, [state.sessionId, state.pendingApproval, state.currentIteration, state.currentStep]);

  const reset = useCallback(() => {
    esSrcRef.current?.close();
    setState(initialState);
  }, []);

  const load = useCallback(async (sessionId: string) => {
    esSrcRef.current?.close();
    try {
      const session = await getSession(sessionId);
      setState({
        sessionId: session.session_id,
        phase: session.state.toLowerCase() as any,
        mode: session.mode,
        dbms: session.dbms,
        playbookId: session.playbook_id,
        playbookTitle: session.playbook_id,
        intentCategory: null,
        currentStep: null,
        currentIteration: session.iteration,
        nodes: session.checkpoint_log.map(entry => ({
          iteration: entry.iteration,
          step_id: entry.step_id,
          step_description: entry.step_description,
          state: 'complete',
          row_count: entry.row_count,
          dba_decision: entry.dba_decision,
          routing_decision: entry.routing_decision,
        })),
        pendingApproval: null,
        lastEvaluation: null,
        analysis: session.analysis || null,
        checkpointLog: session.checkpoint_log,
        errorMessage: null,
        stepsExecuted: session.steps_executed,
        stepsSkipped: session.steps_skipped,
        serverName: session.server_name || '',
        ticketNumber: session.ticket_number || '',
        question: session.question || '',
        created_at: session.created_at || ''
      });
    } catch (e: any) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        errorMessage: e.response?.data?.detail || 'Failed to load past session details.'
      }));
    }
  }, []);

  const stop = useCallback(async () => {
    if (!state.sessionId) return;
    try {
      await stopSession(state.sessionId);
    } catch (e) {
      console.error('Failed to stop session on backend:', e);
    }
    if (esSrcRef.current) {
      esSrcRef.current.close();
      esSrcRef.current = null;
    }
    try {
      const session = await getSession(state.sessionId);
      setState(prev => ({
        ...prev,
        phase: 'complete',
        analysis: session.analysis || null,
        checkpointLog: session.checkpoint_log,
        stepsExecuted: session.steps_executed,
        stepsSkipped: session.steps_skipped,
      }));
    } catch (err) {
      setState(prev => ({ ...prev, phase: 'complete' }));
    }
  }, [state.sessionId]);

  return { state, run, submitDecision, reset, load, stop };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function upsertNode(
  nodes: CheckpointNode[],
  update: CheckpointNode,
): CheckpointNode[] {
  const idx = nodes.findIndex(n => n.step_id === update.step_id);
  if (idx >= 0) {
    const updated = [...nodes];
    updated[idx] = { ...updated[idx], ...update };
    return updated;
  }
  return [...nodes, update];
}
