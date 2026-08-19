import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import DatabaseDriver from 'better-sqlite3';
import { readCodexLiveSession, readCodexWorkerUsage } from '../src/services/codex-local-session-store.js';

test('reads bounded per-worker usage without retaining rollout content', async () => {
  const codexHome = mkdtempSync(join(tmpdir(), 'aas-codex-store-'));
  const sessions = join(codexHome, 'sessions');
  mkdirSync(sessions);
  const parentRollout = join(sessions, 'parent.jsonl');
  const childRollout = join(sessions, 'child.jsonl');
  const usage = (input, cached, output, reasoning) => JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: 0, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output }, last_token_usage: { total_tokens: 75 }, model_context_window: 300 } } });
  writeFileSync(parentRollout, `${JSON.stringify({ payload: { message: 'must not be returned' } })}\n${JSON.stringify({ timestamp: '2026-08-19T00:00:00.000Z', type: 'response_item', payload: { type: 'message', role: 'user', content: 'private prompt' } })}\n${JSON.stringify({ timestamp: '2026-08-19T00:00:02.500Z', type: 'response_item', payload: { type: 'custom_tool_call', input: 'cat AGENTS.md .agents/skills/develop-feature/SKILL.md' } })}\n${JSON.stringify({ type: 'event_msg', payload: { type: 'task_started' } })}\n${JSON.stringify({ type: 'event_msg', payload: { type: 'web_search_end', query: 'private query' } })}\n${usage(100, 60, 20, 5)}\n`);
  writeFileSync(childRollout, `${usage(40, 10, 8, 2)}\n`);
  const sqlite = new DatabaseDriver(join(codexHome, 'state_5.sqlite'));
  sqlite.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, model TEXT, reasoning_effort TEXT, agent_nickname TEXT, agent_role TEXT, rollout_path TEXT, title TEXT, cwd TEXT); CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT PRIMARY KEY, status TEXT);');
  sqlite.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('thread-parent', 'gpt-sol', 'low', null, null, parentRollout, 'Build safely', '/private/repositories/example');
  sqlite.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('thread-child', 'gpt-luna', 'medium', 'Tester', 'tester', childRollout, null, null);
  sqlite.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?, ?)').run('thread-parent', 'thread-child', 'completed');
  sqlite.close();
  const workers = await readCodexWorkerUsage('thread-parent', { codexHome });
  assert.deepEqual(workers.map(worker => ({ id: worker.externalThreadId, model: worker.model, total: worker.totalTokens })), [
    { id: 'thread-parent', model: 'gpt-sol', total: 120 },
    { id: 'thread-child', model: 'gpt-luna', total: 48 },
  ]);
  assert.equal(JSON.stringify(workers).includes('must not be returned'), false);
  const live = await readCodexLiveSession('thread-parent', { codexHome });
  assert.equal(live.status, 'active');
  assert.equal(live.repositoryName, 'example');
  assert.equal(live.contextPercent, 25);
  assert.equal(live.evidence.webSearch, 1);
  assert.deepEqual(live.guidance, { available: true, agentsReads: 1, skillReads: 1, skillsUsed: ['develop-feature'], promptCount: 1, promptsWithSkillRead: 1, averageSkillReadLatencyMs: 2500, currentPromptHasSkillRead: true });
  assert.equal(JSON.stringify(live).includes('private query'), false);

  appendFileSync(parentRollout, `${JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } })}\n${usage(120, 80, 30, 6)}\n`);
  const appended = await readCodexLiveSession('thread-parent', { codexHome });
  assert.equal(appended.status, 'idle');
  assert.equal(appended.evidence.webSearch, 1);
  assert.equal(appended.completedTurnCount, 1);
  assert.equal(appended.workers[0].totalTokens, 150);

  const cyclic = new DatabaseDriver(join(codexHome, 'state_5.sqlite'));
  cyclic.prepare('INSERT INTO thread_spawn_edges VALUES (?, ?, ?)').run('thread-child', 'thread-parent', 'completed');
  cyclic.close();
  assert.equal((await readCodexWorkerUsage('thread-parent', { codexHome })).length, 2);

  writeFileSync(parentRollout, `${usage(2, 1, 1, 0)}\n`);
  const truncated = await readCodexLiveSession('thread-parent', { codexHome });
  assert.equal(truncated.evidence.webSearch ?? 0, 0);
  assert.equal(truncated.workers[0].totalTokens, 3);
});
