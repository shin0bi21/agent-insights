import { createHash, randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { createDatabase } from '../db/client.js';
import { databasePath } from '../db/config.js';
import type { Database, SessionStatus } from '../db/database.js';
import { migrate } from '../db/migrator.js';
import { listCodexStoredSessions, readCodexStoredSession } from './codex-session-source.js';

export type SessionWorkerUsage = {
  externalThreadId: string;
  parentExternalThreadId: string | null;
  nickname: string | null;
  role: string | null;
  model: string;
  reasoningLevel: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

type Source = {
  list(): ReturnType<typeof listCodexStoredSessions>;
  read(id: string): ReturnType<typeof readCodexStoredSession>;
  workers?(id: string): Promise<SessionWorkerUsage[]>;
};

const stableId = (prefix: string, value: string) => `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
const sessionStatus = (value: string): SessionStatus => value === 'completed' ? 'completed' : value === 'failed' ? 'failed' : value === 'interrupted' || value === 'cancelled' ? 'interrupted' : value === 'active' ? 'active' : 'idle';
const turnStatus = (value: string) => value === 'completed' ? 'completed' : value === 'failed' ? 'failed' : value === 'interrupted' || value === 'cancelled' ? 'interrupted' : 'unknown';

async function review(database: Kysely<Database>, id: string) {
  const row = await database.selectFrom('session_summary as summary')
    .innerJoin('sessions as session', 'session.id', 'summary.session_id')
    .innerJoin('session_sources as source', 'source.session_id', 'summary.session_id')
    .leftJoin('session_repositories as repository', 'repository.session_id', 'summary.session_id')
    .select([
      'summary.session_id as id', 'session.title', 'summary.status', 'summary.telemetry_level as telemetryLevel',
      'summary.observed_sequence as observedSequence', 'summary.durable_sequence as durableSequence',
      'summary.started_at as startedAt', 'summary.completed_at as completedAt', 'summary.turn_count as turnCount',
      'summary.event_count as eventCount', 'summary.check_count as checkCount',
      'summary.changed_file_event_count as changedFileEventCount', 'summary.input_tokens as inputTokens',
      'summary.cached_input_tokens as cachedInputTokens', 'summary.output_tokens as outputTokens',
      'source.platform', 'source.external_session_id as externalSessionId', 'repository.repository_name as repositoryName',
    ]).where('summary.session_id', '=', id).executeTakeFirst();
  if (!row) return null;
  const groups = await database.selectFrom('session_events').select(['event_type as type'])
    .select(expression => expression.fn.count<number>('id').as('count'))
    .where('session_id', '=', id).groupBy('event_type').execute();
  const workerRows = await database.selectFrom('session_threads as thread')
    .innerJoin('session_turns as turn', 'turn.thread_id', 'thread.id')
    .innerJoin('turn_usage_snapshots as usage', 'usage.turn_id', 'turn.id')
    .select(['thread.id', 'thread.display_name as name', 'thread.role', 'turn.id as turnId', 'turn.model', 'turn.reasoning_level as reasoningLevel', 'usage.id as usageId', 'usage.observed_at as observedAt', 'usage.measurement', 'usage.input_tokens as inputTokens', 'usage.cached_input_tokens as cachedInputTokens', 'usage.cache_write_input_tokens as cacheWriteInputTokens', 'usage.output_tokens as outputTokens', 'usage.reasoning_output_tokens as reasoningOutputTokens'])
    .where('thread.session_id', '=', id)
    .orderBy('usage.observed_at', 'desc').orderBy('usage.id', 'desc').execute();
  const latestByTurn = new Map<string, typeof workerRows[number]>();
  for (const worker of workerRows) if (!latestByTurn.has(worker.turnId)) latestByTurn.set(worker.turnId, worker);
  const byWorker = new Map<string, { id: string; name: string | null; role: string; model: string | null; reasoningLevel: string | null; inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number; reasoningOutputTokens: number; totalTokens: number }>();
  for (const row of latestByTurn.values()) {
    if (row.measurement === 'unavailable') continue;
    const worker = byWorker.get(row.id) ?? { id: row.id, name: row.name, role: row.role, model: row.model, reasoningLevel: row.reasoningLevel, inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 };
    worker.model ??= row.model;
    worker.reasoningLevel ??= row.reasoningLevel;
    worker.inputTokens += row.inputTokens ?? 0;
    worker.cachedInputTokens += row.cachedInputTokens ?? 0;
    worker.cacheWriteInputTokens += row.cacheWriteInputTokens ?? 0;
    worker.outputTokens += row.outputTokens ?? 0;
    worker.reasoningOutputTokens += row.reasoningOutputTokens ?? 0;
    worker.totalTokens = worker.inputTokens + worker.outputTokens;
    byWorker.set(row.id, worker);
  }
  const workers = [...byWorker.values()];
  const byModel = new Map<string, { model: string; workerCount: number; inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number; reasoningOutputTokens: number; totalTokens: number }>();
  for (const worker of workers) {
    const model = worker.model ?? 'unattributed';
    const aggregate = byModel.get(model) ?? { model, workerCount: 0, inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 };
    aggregate.workerCount += 1;
    for (const key of ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens', 'reasoningOutputTokens', 'totalTokens'] as const) aggregate[key] += worker[key] ?? 0;
    byModel.set(model, aggregate);
  }
  return { ...row, evidence: Object.fromEntries(groups.map(group => [group.type, Number(group.count)])), usageAvailable: workers.length > 0, workerUsage: workers, modelUsage: [...byModel.values()] };
}

export function createSessionManager({
  root,
  database,
  source = { list: listCodexStoredSessions, read: readCodexStoredSession },
}: { root: string; database?: Kysely<Database>; source?: Source }) {
  const path = databasePath(root);
  if (!database) migrate({ path });
  const db = database ?? createDatabase(path);

  async function listImported() {
    const rows = await db.selectFrom('sessions').select('id').orderBy('updated_at', 'desc').execute();
    return (await Promise.all(rows.map(row => review(db, row.id)))).filter(Boolean);
  }

  async function importCodex(externalId: string) {
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(externalId)) throw new Error('Invalid Codex session ID.');
    const thread = await source.read(externalId);
    const workers = source.workers ? await source.workers(externalId) : [];
    const id = stableId('session', `codex:${externalId}`);
    const threadId = stableId('thread', `codex:${externalId}`);
    const safeTitle = `Codex session ${externalId.slice(0, 8)}`;
    const now = new Date().toISOString();
    const startedAt = thread.createdAt ?? now;
    const normalizedStatus = sessionStatus(thread.status);
    const terminal = normalizedStatus === 'completed' || normalizedStatus === 'failed' || normalizedStatus === 'interrupted';
    const observedAt = thread.updatedAt ?? now;
    const completedAt = terminal ? observedAt : null;
    const events = thread.turns.flatMap((turn, turnIndex) => turn.items.map((item, itemIndex) => ({ turn, turnIndex, item, itemIndex })));
    await db.transaction().execute(async transaction => {
      const existingSession = await transaction.selectFrom('sessions').selectAll().where('id', '=', id).executeTakeFirst();
      const existingEvents = await transaction.selectFrom('session_events')
        .select(['source_event_key', 'sequence_number']).where('session_id', '=', id).execute();
      const existingKeys = new Set(existingEvents.map(event => event.source_event_key));
      const canAppendEvents = !existingSession || existingSession.observed_sequence === existingSession.durable_sequence;
      let nextSequence = Math.max(existingSession?.observed_sequence ?? 0, ...existingEvents.map(event => event.sequence_number), 0);
      const newEvents = canAppendEvents ? events.filter(({ turn, item }) => !existingKeys.has(`import:${turn.id}:${item.id}`)) : [];
      const importedStatus = existingSession && existingSession.telemetry_level !== 'imported' ? existingSession.status : normalizedStatus;
      const importedCompletedAt = existingSession && existingSession.telemetry_level !== 'imported' ? existingSession.completed_at : completedAt;
      const observedSequence = nextSequence + newEvents.length;
      const durableSequence = canAppendEvents ? observedSequence : existingSession?.durable_sequence ?? 0;
      await transaction.insertInto('sessions').values({
        id, title: safeTitle, status: importedStatus, telemetry_level: existingSession?.telemetry_level ?? 'imported',
        observed_sequence: observedSequence, durable_sequence: durableSequence, created_at: existingSession?.created_at ?? now,
        started_at: existingSession?.started_at ?? startedAt, last_observed_at: observedAt,
        last_persisted_at: now, completed_at: importedCompletedAt, updated_at: now,
      }).onConflict(conflict => conflict.column('id').doUpdateSet({
        title: safeTitle, status: importedStatus, telemetry_level: existingSession?.telemetry_level ?? 'imported',
        observed_sequence: observedSequence, durable_sequence: durableSequence,
        last_observed_at: observedAt, last_persisted_at: now, completed_at: importedCompletedAt, updated_at: now,
      })).execute();
      await transaction.insertInto('session_sources').values({
        id: stableId('source', `codex:${externalId}`), session_id: id, platform: 'codex', external_session_id: externalId,
        source_kind: 'imported', adapter_version: 'codex-app-server-v2', sync_status: 'synced',
        sync_cursor: String(durableSequence), last_synced_at: now, sync_error: null,
      }).onConflict(conflict => conflict.columns(['platform', 'external_session_id']).doUpdateSet({
        adapter_version: 'codex-app-server-v2', sync_status: 'synced', sync_cursor: String(durableSequence),
        last_synced_at: now, sync_error: null,
      })).execute();
      if (thread.repositoryName) await transaction.insertInto('session_repositories').values({
        session_id: id, repository_name: thread.repositoryName, base_revision: thread.revision,
        final_revision: thread.revision, guidance_revision: null, working_tree_dirty: null, attached_at: now,
      }).onConflict(conflict => conflict.column('session_id').doUpdateSet({
        repository_name: thread.repositoryName!, base_revision: thread.revision,
        final_revision: thread.revision, attached_at: now,
      })).execute();
      await transaction.insertInto('session_threads').values({
        id: threadId, session_id: id, external_thread_id: externalId, parent_thread_id: null, role: 'orchestrator',
        status: normalizedStatus, started_at: startedAt, completed_at: completedAt,
        display_name: 'Main agent',
      }).onConflict(conflict => conflict.columns(['session_id', 'external_thread_id']).doUpdateSet({
        status: normalizedStatus, completed_at: completedAt, display_name: 'Main agent',
      })).execute();
      const rootWorker = workers.find(worker => worker.externalThreadId === externalId);
      const rootUsageTurnId = rootWorker && thread.turns.length ? stableId('turn', `${externalId}:${thread.turns.at(-1)!.id}`) : null;
      for (const [index, turn] of thread.turns.entries()) {
        const turnId = stableId('turn', `${externalId}:${turn.id}`);
        await transaction.insertInto('session_turns').values({
          id: turnId, thread_id: threadId, external_turn_id: turn.id, sequence_number: index + 1,
          provider: 'codex', model: null, reasoning_level: null, status: turnStatus(turn.status),
          started_at: null, completed_at: null, duration_ms: null,
        }).onConflict(conflict => conflict.columns(['thread_id', 'external_turn_id']).doUpdateSet({
          status: turnStatus(turn.status),
        })).execute();
        if (turnId !== rootUsageTurnId) await transaction.insertInto('turn_usage_snapshots').values({
          id: randomUUID(), turn_id: turnId, source_event_key: `import:${turn.id}:usage-unavailable`, measurement: 'unavailable',
          input_tokens: null, cached_input_tokens: null, output_tokens: null, reasoning_output_tokens: null, observed_at: observedAt,
          cache_write_input_tokens: null,
        }).onConflict(conflict => conflict.columns(['turn_id', 'source_event_key']).doNothing()).execute();
      }
      for (const [workerIndex, worker] of workers.entries()) {
        if (worker.externalThreadId === externalId) continue;
        const workerThreadId = stableId('thread', `codex:${worker.externalThreadId}`);
        await transaction.insertInto('session_threads').values({
          id: workerThreadId, session_id: id, external_thread_id: worker.externalThreadId,
          parent_thread_id: null, role: 'other', status: terminal ? 'completed' : 'idle',
          started_at: null, completed_at: completedAt, display_name: worker.nickname ?? `Worker ${workerIndex + 1}`,
        }).onConflict(conflict => conflict.columns(['session_id', 'external_thread_id']).doUpdateSet({
          status: terminal ? 'completed' : 'idle', completed_at: completedAt,
          display_name: worker.nickname ?? `Worker ${workerIndex + 1}`,
        })).execute();
      }
      for (const worker of workers) {
        if (worker.externalThreadId === externalId) continue;
        const workerThreadId = stableId('thread', `codex:${worker.externalThreadId}`);
        const parentThreadId = worker.parentExternalThreadId
          ? stableId('thread', `codex:${worker.parentExternalThreadId}`) : threadId;
        const parent = await transaction.selectFrom('session_threads').select('id').where('id', '=', parentThreadId).executeTakeFirst();
        await transaction.updateTable('session_threads').set({ parent_thread_id: parent?.id ?? threadId })
          .where('id', '=', workerThreadId).execute();
      }
      for (const worker of workers) {
        const isRoot = worker.externalThreadId === externalId;
        const workerThreadId = isRoot ? threadId : stableId('thread', `codex:${worker.externalThreadId}`);
        let usageTurnId: string;
        if (isRoot && thread.turns.length) usageTurnId = stableId('turn', `${externalId}:${thread.turns.at(-1)!.id}`);
        else {
          usageTurnId = stableId('turn', `${worker.externalThreadId}:worker-usage`);
          await transaction.insertInto('session_turns').values({
            id: usageTurnId, thread_id: workerThreadId, external_turn_id: 'worker-usage', sequence_number: 1,
            provider: 'codex', model: worker.model, reasoning_level: worker.reasoningLevel, status: 'completed',
            started_at: null, completed_at: completedAt, duration_ms: null,
          }).onConflict(conflict => conflict.columns(['thread_id', 'external_turn_id']).doUpdateSet({
            model: worker.model, reasoning_level: worker.reasoningLevel, status: terminal ? 'completed' : 'unknown',
          })).execute();
        }
        await transaction.insertInto('turn_usage_snapshots').values({
          id: randomUUID(), turn_id: usageTurnId, source_event_key: `local-rollout:${worker.externalThreadId}:final`, measurement: 'exact-stored',
          input_tokens: worker.inputTokens, cached_input_tokens: worker.cachedInputTokens,
          cache_write_input_tokens: worker.cacheWriteInputTokens, output_tokens: worker.outputTokens,
          reasoning_output_tokens: worker.reasoningOutputTokens, observed_at: observedAt,
        }).onConflict(conflict => conflict.columns(['turn_id', 'source_event_key']).doUpdateSet({
          measurement: 'exact-stored', input_tokens: worker.inputTokens, cached_input_tokens: worker.cachedInputTokens,
          cache_write_input_tokens: worker.cacheWriteInputTokens, output_tokens: worker.outputTokens,
          reasoning_output_tokens: worker.reasoningOutputTokens, observed_at: observedAt,
        })).execute();
        await transaction.updateTable('session_turns').set({ model: worker.model, reasoning_level: worker.reasoningLevel }).where('id', '=', usageTurnId).execute();
      }
      if (newEvents.length) await transaction.insertInto('session_events').values(newEvents.map(({ turn, item }) => ({
        id: randomUUID(), session_id: id, thread_id: threadId, turn_id: stableId('turn', `${externalId}:${turn.id}`),
        sequence_number: ++nextSequence, source_event_key: `import:${turn.id}:${item.id}`, event_type: item.type,
        status: item.status, occurred_at: observedAt, summary: null, evidence_json: null,
      }))).execute();
    });
    return review(db, id);
  }

  return {
    listSourceSessions: () => source.list(),
    listImported,
    get: (id: string) => /^[a-zA-Z0-9-]+$/.test(id) ? review(db, id) : null,
    importCodex,
  };
}
