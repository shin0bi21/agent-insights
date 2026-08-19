import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeDatabase, createDatabase } from '../src/db/client.js';
import { migrate } from '../src/db/migrator.js';
import { createSessionManager } from '../src/services/session-manager.js';

test('imports a Codex session as content-free normalized review evidence', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'aas-session-manager-')), 'test.sqlite');
  migrate({ path });
  const database = createDatabase(path);
  const source = {
    list: async () => [{ externalId: 'thread-12345678', title: 'Feature work', repositoryName: 'example', source: 'vscode', status: 'notLoaded', createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T01:00:00.000Z', branch: 'develop', revision: 'abc123' }],
    read: async () => ({
      externalId: 'thread-12345678', title: 'Feature work', repositoryName: 'example', source: 'vscode', status: 'notLoaded',
      createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T01:00:00.000Z', branch: 'develop', revision: 'abc123',
      turns: [{ id: 'turn-1', status: 'completed', items: [{ id: 'item-1', type: 'fileChange', status: 'completed' }, { id: 'item-2', type: 'contextCompaction', status: null }] }],
    }),
    workers: async () => [{ externalThreadId: 'thread-12345678', parentExternalThreadId: null, nickname: null, role: null, model: 'gpt-5.6-sol', reasoningLevel: 'low', inputTokens: 100, cachedInputTokens: 60, cacheWriteInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 5, totalTokens: 120 }],
  };
  try {
    const manager = createSessionManager({ root: process.cwd(), database, source });
    const first = await manager.importCodex('thread-12345678');
    assert.equal(first?.title, 'Codex session thread-1');
    assert.equal(first?.status, 'idle');
    assert.equal(first?.telemetryLevel, 'imported');
    const durableTurn = await database.selectFrom('session_turns').select('id').executeTakeFirstOrThrow();
    await database.insertInto('session_events').values({
      id: 'live-event', session_id: first!.id, thread_id: null, turn_id: durableTurn.id,
      sequence_number: 3, source_event_key: 'live:turn.completed', event_type: 'turn.completed',
      status: 'completed', occurred_at: '2026-08-18T02:00:00.000Z', summary: null, evidence_json: null,
    }).execute();
    await database.updateTable('sessions').set({
      telemetry_level: 'full', observed_sequence: 3, durable_sequence: 3,
    }).where('id', '=', first!.id).execute();
    const second = await manager.importCodex('thread-12345678');
    assert.equal(first?.id, second?.id);
    assert.equal(second?.turnCount, 1);
    assert.equal(second?.eventCount, 3);
    assert.equal(second?.telemetryLevel, 'full');
    assert.deepEqual(second?.evidence, { contextCompaction: 1, fileChange: 1, 'turn.completed': 1 });
    assert.equal(second?.usageAvailable, true);
    assert.deepEqual(second?.modelUsage, [{ model: 'gpt-5.6-sol', workerCount: 1, inputTokens: 100, cachedInputTokens: 60, cacheWriteInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 5, totalTokens: 120 }]);
    assert.equal(await database.selectFrom('sessions').selectAll().execute().then(rows => rows.length), 1);
    const storedEvent = await database.selectFrom('session_events').selectAll().where('source_event_key', '=', 'import:turn-1:item-1').executeTakeFirstOrThrow();
    assert.equal(storedEvent.summary, null);
    assert.equal(storedEvent.evidence_json, null);
  } finally { await closeDatabase(database); }
});
