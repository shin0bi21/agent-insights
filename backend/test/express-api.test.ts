import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createBenchmarkApp } from '../src/http/app.js';
import { resolveServerHost } from '../src/http/server-config.js';

async function withApp(app, run) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('Express API preserves run routes with an injected manager', async () => {
  const calls = [];
  const manager = {
    list: () => [{ id: 'run-1' }],
    get: id => id === 'run-1' ? { id } : null,
    start: input => { calls.push(input); return { id: 'run-2', ...input }; },
  };
  const app = createBenchmarkApp({
    root: process.cwd(),
    manager,
    providers: () => [{ id: 'codex' }],
    directoryPickerAvailable: false,
    repositoryPath: '/workspace/repository',
  });
  await withApp(app, async origin => {
    const health = await fetch(`${origin}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const runs = await fetch(`${origin}/api/runs`);
    assert.equal(runs.status, 200);
    assert.deepEqual(await runs.json(), [{ id: 'run-1' }]);
    assert.equal(runs.headers.get('cache-control'), 'no-store');

    const providerResponse = await fetch(`${origin}/api/providers`);
    assert.deepEqual(await providerResponse.json(), [{ id: 'codex' }]);

    const runtimeResponse = await fetch(`${origin}/api/runtime`);
    assert.deepEqual(await runtimeResponse.json(), {
      directoryPickerAvailable: false,
      repositoryPath: '/workspace/repository',
    });

    const started = await fetch(`${origin}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-luna' }),
    });
    assert.equal(started.status, 202);
    assert.deepEqual(calls, [{ model: 'gpt-5.6-luna' }]);
  });
});

test('server binding stays loopback by default and requires an explicit container host', () => {
  assert.equal(resolveServerHost({}), '127.0.0.1');
  assert.equal(resolveServerHost({ AGENT_AUTOMATION_SCORE_HOST: '0.0.0.0' }), '0.0.0.0');
  assert.equal(resolveServerHost({ REPO_AUTOMATION_SCORE_HOST: '::1' }), '::1');
  assert.throws(() => resolveServerHost({ AGENT_AUTOMATION_SCORE_HOST: 'example.com' }), /loopback or all-interface/);
});

test('session source probe stays behind an injectable API boundary', async () => {
  const app = createBenchmarkApp({
    root: process.cwd(),
    manager: { list: () => [], get: () => null, start: () => null },
    probeSessions: async () => ({
      connected: true,
      loadedThreadIds: ['thread-1'],
      storedThreadAvailable: true,
    }),
  });

  await withApp(app, async origin => {
    const response = await fetch(`${origin}/api/session-source/probe`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      connected: true,
      loadedThreadIds: ['thread-1'],
      storedThreadAvailable: true,
    });
  });
});

test('stored session list, import, and review stay behind the session manager boundary', async () => {
  const imported = [];
  const sessionManager = {
    listSourceSessions: async () => [{ externalId: 'thread-12345678' }],
    listImported: async () => [{ id: 'session-1' }],
    get: async id => id === 'session-1' ? { id } : null,
    importCodex: async externalId => {
      imported.push(externalId);
      if (externalId === 'thread-invalid') throw new Error('Import failed safely.');
      return { id: 'session-1', externalSessionId: externalId };
    },
  };
  const app = createBenchmarkApp({
    root: process.cwd(),
    manager: { list: () => [], get: () => null, start: () => null },
    sessionManager,
  });
  await withApp(app, async origin => {
    assert.deepEqual(await fetch(`${origin}/api/session-sources/codex/sessions`).then(response => response.json()), [{ externalId: 'thread-12345678' }]);
    assert.deepEqual(await fetch(`${origin}/api/sessions`).then(response => response.json()), [{ id: 'session-1' }]);
    assert.deepEqual(await fetch(`${origin}/api/sessions/session-1`).then(response => response.json()), { id: 'session-1' });
    assert.equal((await fetch(`${origin}/api/sessions/missing`)).status, 404);

    const created = await fetch(`${origin}/api/sessions/import`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'codex', externalSessionId: 'thread-12345678' }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(imported, ['thread-12345678']);
    const invalid = await fetch(`${origin}/api/sessions/import`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'other' }),
    });
    assert.equal(invalid.status, 400);
  });
});

test('live Codex telemetry stays behind an injectable API boundary', async () => {
  const app = createBenchmarkApp({
    root: process.cwd(),
    manager: { list: () => [], get: () => null, start: () => null },
    readLiveSession: async id => ({ externalId: id, title: 'Live', repositoryName: 'repo', status: 'active', observedAt: '2026-08-19T00:00:00.000Z', contextWindow: 100, contextTokens: 40, contextPercent: 40, turnCount: 2, completedTurnCount: 1, evidence: {}, guidance: { available: true, agentsReads: 0, skillReads: 0, skillsUsed: [], promptCount: 0, promptsWithSkillRead: 0, averageSkillReadLatencyMs: null, currentPromptHasSkillRead: null }, workers: [] }),
  });
  await withApp(app, async origin => {
    const response = await fetch(`${origin}/api/session-sources/codex/sessions/thread-1234/live`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).contextPercent, 40);
  });
});

test('Express API returns JSON for validation, parse, and not-found failures', async () => {
  const app = createBenchmarkApp({
    root: process.cwd(),
    manager: { list: () => [], get: () => null, start: () => { throw new Error('Invalid run.'); } },
    validateGuidance: () => { throw new Error('Repository directory does not exist.'); },
  });
  await withApp(app, async origin => {
    const missing = await fetch(`${origin}/api/runs/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Run not found.' });

    const validation = await fetch(`${origin}/api/repository`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(validation.status, 400);
    assert.deepEqual(await validation.json(), { error: 'Repository directory does not exist.' });

    const malformed = await fetch(`${origin}/api/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    const payload = await malformed.json();
    assert.match(payload.error, /JSON|Unexpected/i);
  });
});
