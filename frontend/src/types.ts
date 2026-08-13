export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'interrupted';

export interface AgentModel { id: string; label: string }
export interface AgentProvider { id: string; label: string; models: AgentModel[] }
export interface RepositorySkill { name: string; description: string; path: string }
export interface RepositoryConnection { repo: string; skills: RepositorySkill[] }

export interface ComparisonRow {
  medianScore: number | null;
  medianDurationMs: number | null;
  missedRequirements: Record<string, number>;
}

export interface RunRecord {
  id: string;
  createdAt: string;
  repo: string;
  provider?: string;
  model: string;
  reasoningEffort: string;
  skill: string | null;
  description: string;
  status: RunStatus;
  artifactPath: string;
  progress: string;
  comparison: { comparison: ComparisonRow[] } | null;
}

export interface StartRunInput {
  repo: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  skill: string;
  description: string;
}
