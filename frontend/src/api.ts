import type { AgentProvider, RepositoryConnection, RunRecord, StartRunInput } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export const api = {
  providers: () => request<AgentProvider[]>('/api/providers'),
  runs: () => request<RunRecord[]>('/api/runs'),
  connectRepository: (repo: string) => request<RepositoryConnection>('/api/repository', { method: 'POST', body: JSON.stringify({ repo }) }),
  pickDirectory: () => request<{ repo: string }>('/api/pick-directory', { method: 'POST', body: '{}' }),
  startRun: (input: StartRunInput) => request<RunRecord>('/api/runs', { method: 'POST', body: JSON.stringify(input) }),
};
