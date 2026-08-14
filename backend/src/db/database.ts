import type { Generated } from 'kysely';

export type SqliteBoolean = 0 | 1;

export interface SchemaMigrationsTable {
  version: string;
  checksum: string;
  applied_at: string;
}

export interface RunsTable {
  id: string;
  repository_name: string;
  base_revision: string;
  guidance_revision: string | null;
  working_tree_dirty: SqliteBoolean;
  feature_type: 'frontend' | 'backend' | 'full-stack';
  description: string;
  prepared_prompt: string;
  prompt_template_version: string;
  evaluation_template: string;
  requested_repetitions: number;
  requested_review_passes: number;
  status: string;
  runner_version: string | null;
  provider_cli_version: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunAgentSetupTable {
  run_id: string;
  provider: string;
  agent: string;
  reasoning_level: string;
}

export interface RunAttemptsTable {
  id: string;
  run_id: string;
  attempt_number: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  failure_summary: string | null;
}

export interface RunPassesTable {
  id: string;
  attempt_id: string;
  pass_number: number;
  pass_type: 'initial' | 'review';
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  final_response: string | null;
}

export interface PassTokenUsageTable {
  pass_id: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
}

export interface PassPhasesTable {
  id: string;
  pass_id: string;
  phase_number: number;
  phase: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  summary: string;
  outcome: string | null;
}

export interface PassEventsTable {
  id: string;
  pass_id: string;
  sequence_number: number;
  event_type: string;
  status: string | null;
  occurred_at: string;
  summary: string | null;
  payload_json: string | null;
}

export interface PassChecksTable {
  id: string;
  pass_id: string;
  check_type: string;
  command_label: string | null;
  status: string;
  duration_ms: number | null;
  tests_passed: number | null;
  tests_failed: number | null;
  tests_skipped: number | null;
  summary: string | null;
}

export interface PassChangesTable {
  id: string;
  pass_id: string;
  file_path: string;
  change_type: string;
  lines_added: number | null;
  lines_removed: number | null;
}

export interface PassEvaluationsTable {
  id: string;
  pass_id: string;
  score: number | null;
  evaluator_version: string;
  created_at: string;
}

export interface StructuralFindingsTable {
  id: string;
  evaluation_id: string;
  contract_id: string;
  label: string;
  implemented: SqliteBoolean;
  severity: string | null;
  evidence_json: string | null;
}

export interface ImplementationFindingsTable {
  id: string;
  evaluation_id: string;
  section_id: string;
  section_label: string;
  requirement_id: string;
  requirement_label: string;
  implemented: SqliteBoolean;
  candidate_files_json: string | null;
  reference_files_json: string | null;
}

export interface ExecutionFindingsTable {
  id: string;
  pass_id: string;
  category: string;
  severity: string | null;
  summary: string;
  recommendation: string | null;
  evidence_json: string | null;
}

export interface RunRecommendationsTable {
  id: string;
  run_id: string;
  attempt_id: string | null;
  pass_id: string | null;
  category: string;
  summary: string;
  evidence_json: string | null;
  created_at: string;
}

export interface AttemptSummaryView {
  attempt_id: string;
  run_id: string;
  attempt_number: number;
  status: string;
  initial_score: number | null;
  final_score: number | null;
  score_improvement: number | null;
  duration_ms: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  pass_count: number;
  review_pass_count: number;
  tests_passed: number;
  tests_failed: number;
  tests_skipped: number;
  failed_command_count: number;
  retry_count: number;
  changed_file_count: number;
}

export interface RunSummaryView {
  run_id: string;
  repository_name: string;
  status: string;
  requested_repetitions: number;
  requested_review_passes: number;
  attempt_count: number;
  average_score: number | null;
  minimum_score: number | null;
  maximum_score: number | null;
  score_variance: number | null;
  duration_ms: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  failed_command_count: number;
  retry_count: number;
  changed_file_count: number;
}

export interface Database {
  schema_migrations: SchemaMigrationsTable;
  runs: RunsTable;
  run_agent_setup: RunAgentSetupTable;
  run_attempts: RunAttemptsTable;
  run_passes: RunPassesTable;
  pass_token_usage: PassTokenUsageTable;
  pass_phases: PassPhasesTable;
  pass_events: PassEventsTable;
  pass_checks: PassChecksTable;
  pass_changes: PassChangesTable;
  pass_evaluations: PassEvaluationsTable;
  structural_findings: StructuralFindingsTable;
  implementation_findings: ImplementationFindingsTable;
  execution_findings: ExecutionFindingsTable;
  run_recommendations: RunRecommendationsTable;
  attempt_summary: AttemptSummaryView;
  run_summary: RunSummaryView;
}

export type DatabaseId = Generated<string>;
