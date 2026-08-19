export type RunStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed-out'
  | 'interrupted';

export interface AgentModel {
  id: string;
  label: string;
}

export interface AgentProvider {
  id: string;
  label: string;
  models: AgentModel[];
}

export interface RepositorySkill {
  name: string;
  description: string;
  path: string;
}

export interface RepositoryConnection {
  repo: string;
  skills: RepositorySkill[];
}

export interface RuntimeCapabilities {
  directoryPickerAvailable: boolean;
  repositoryPath: string | null;
}

export interface SessionSourceProbe {
  connected: true;
  loadedThreadIds: string[];
  storedThreadAvailable: boolean;
}

export interface StoredCodexSession {
  externalId: string;
  title: string;
  repositoryName: string | null;
  source: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  branch: string | null;
  revision: string | null;
}

export interface LiveSessionSnapshot {
  externalId: string;
  title: string;
  repositoryName: string | null;
  status: string;
  observedAt: string;
  contextWindow: number | null;
  contextTokens: number;
  contextPercent: number | null;
  turnCount: number;
  completedTurnCount: number;
  evidence: Record<string, number>;
  guidance: {
    available: boolean;
    agentsReads: number;
    skillReads: number;
    skillsUsed: string[];
    promptCount: number;
    promptsWithSkillRead: number;
    averageSkillReadLatencyMs: number | null;
    currentPromptHasSkillRead: boolean | null;
  };
  workers: LiveWorkerTokenUsage[];
}

export interface LiveWorkerTokenUsage {
  externalThreadId: string;
  parentExternalThreadId: string | null;
  nickname: string | null;
  role: string | null;
  model: string | null;
  reasoningLevel: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  active: boolean;
  updatedAt: string;
}

export interface SessionReview {
  id: string;
  title: string | null;
  status: string;
  telemetryLevel: 'full' | 'imported' | 'partial';
  observedSequence: number;
  durableSequence: number;
  startedAt: string | null;
  completedAt: string | null;
  turnCount: number;
  eventCount: number;
  checkCount: number;
  changedFileEventCount: number;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  platform: string;
  externalSessionId: string;
  repositoryName: string | null;
  evidence: Record<string, number>;
  usageAvailable: boolean;
  workerUsage: WorkerTokenUsage[];
  modelUsage: ModelTokenUsage[];
}

export interface WorkerTokenUsage {
  id: string;
  name: string | null;
  role: string;
  model: string | null;
  reasoningLevel: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteInputTokens: number | null;
  outputTokens: number | null;
  reasoningOutputTokens: number | null;
  totalTokens: number;
}

export interface ModelTokenUsage {
  model: string;
  workerCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
}

export interface ComparisonRow {
  medianScore: number | null;
  medianDurationMs: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  missedRequirements: Record<string, number>;
  implementationReview: ImplementationReviewSection[] | null;
}

export interface ImplementationReviewItem {
  id: string;
  label: string;
  implemented: boolean;
  candidateFiles: string[];
  referenceFiles: string[];
}

export interface ImplementationReviewSection {
  id: string;
  label: string;
  classification: 'reference-derived';
  items: ImplementationReviewItem[];
}

export interface RunActivityNode {
  id: string;
  parentId: string | null;
  kind: 'phase' | 'agent_message' | 'command_execution' | 'file_change';
  label: string;
  detail: string;
  status: 'running' | 'completed' | 'failed';
}

export interface RunRecord {
  id: string;
  createdAt: string;
  repo?: string;
  repositoryName?: string;
  provider?: string;
  model: string;
  reasoningEffort: string;
  skill?: string | null;
  featureType?: FeatureType;
  description: string;
  status: RunStatus;
  artifactPath?: string;
  progress?: string;
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
