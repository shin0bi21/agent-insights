import type {
  AgentProvider,
  RepositoryConnection,
  RuntimeCapabilities,
  SessionSourceProbe,
  SessionReview,
  LiveSessionSnapshot,
  StoredCodexSession,
  RunRecord,
  StartRunInput,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

export const api = {
  providers: () => request<AgentProvider[]>('/api/providers'),
  runtime: () => request<RuntimeCapabilities>('/api/runtime'),
  runs: () => request<RunRecord[]>('/api/runs'),
  probeSessionSource: () => request<SessionSourceProbe>(
    '/api/session-source/probe',
    { method: 'POST', body: '{}' },
  ),
  storedCodexSessions: () => request<StoredCodexSession[]>('/api/session-sources/codex/sessions'),
  liveCodexSession: (externalSessionId: string) => request<LiveSessionSnapshot>(
    `/api/session-sources/codex/sessions/${encodeURIComponent(externalSessionId)}/live`,
  ),
  sessions: () => request<SessionReview[]>('/api/sessions'),
  importCodexSession: (externalSessionId: string) => request<SessionReview>(
    '/api/sessions/import',
    { method: 'POST', body: JSON.stringify({ source: 'codex', externalSessionId }) },
  ),
  connectRepository: (repo: string) => request<RepositoryConnection>(
    '/api/repository',
    { method: 'POST', body: JSON.stringify({ repo }) },
  ),
  pickDirectory: () => request<{ repo: string }>(
    '/api/pick-directory',
    { method: 'POST', body: '{}' },
  ),
  startRun: (input: StartRunInput) => request<RunRecord>(
    '/api/runs',
    { method: 'POST', body: JSON.stringify(input) },
  ),
};
