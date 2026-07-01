// api/client.ts

import axios from 'axios';
import type {
  DiagnoseRequest, DiagnoseStartResponse,
  CheckpointDecisionRequest, SessionDetail,
  PlaybookSummary,
} from '../types';

const BASE = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

export const startDiagnose = (req: DiagnoseRequest) =>
  api.post<DiagnoseStartResponse>('/diagnose', req).then(r => r.data);

export const submitCheckpointDecision = (
  sessionId: string,
  iteration: number,
  decision: CheckpointDecisionRequest,
) =>
  api.post(`/diagnose/${sessionId}/checkpoint/${iteration}/decision`, decision)
    .then(r => r.data);

export const getSession = (sessionId: string) =>
  api.get<SessionDetail>(`/session/${sessionId}`).then(r => r.data);

export const listPlaybooks = (dbms?: string) =>
  api.get<{ playbooks: PlaybookSummary[] }>('/playbooks', { params: { dbms } })
    .then(r => r.data.playbooks);

export const getHealth = () =>
  api.get('/health').then(r => r.data);

export const shareReport = (sessionId: string, recipient: string, cc?: string, message?: string) =>
  api.post(`/sessions/${sessionId}/share`, { recipient, cc, message }).then(r => r.data);

export const sendChatMessage = (messages: any[]) =>
  api.post('/chat', { messages }).then(r => r.data);

// SSE stream — returns an EventSource
export const openSseStream = (sessionId: string): EventSource => {
  const url = `${BASE}/api/v1/diagnose/${sessionId}/stream?token=local-dev-no-auth`;
  return new EventSource(url);
};
