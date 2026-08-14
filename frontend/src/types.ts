export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timed-out' | 'interrupted';

export interface AgentModel { id: string; label: string }
export interface AgentProvider { id: string; label: string; models: AgentModel[] }
export interface RepositorySkill { name: string; description: string; path: string }
export interface RepositoryConnection { repo: string; skills: RepositorySkill[] }

export interface ComparisonRow {
  medianScore: number | null;
  medianDurationMs: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  missedRequirements: Record<string, number>;
  implementationReview: ImplementationReviewSection[] | null;
}

export interface ImplementationReviewItem { id: string; label: string; implemented: boolean; candidateFiles: string[]; referenceFiles: string[] }
export interface ImplementationReviewSection { id: string; label: string; classification: 'reference-derived'; items: ImplementationReviewItem[] }
export interface RunActivityNode { id: string; parentId: string | null; kind: 'phase' | 'agent_message' | 'command_execution' | 'file_change'; label: string; detail: string; status: 'running' | 'completed' | 'failed' }

export interface RunRecord {
  id: string;
  createdAt: string;
  repo: string;
  provider?: string;
  model: string;
  reasoningEffort: string;
  skill?: string | null;
  featureType?: FeatureType;
  description: string;
  status: RunStatus;
  artifactPath: string;
  progress: string;
  activity?: RunActivityNode[];
  comparison: { comparison: ComparisonRow[] } | null;
}

export interface StartRunInput {
  repo: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  featureType: FeatureType;
  description: string;
}

export type FeatureType = 'frontend' | 'backend' | 'full-stack';
