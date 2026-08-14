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
  assert.equal(resolveServerHost({ REPO_AUTOMATION_SCORE_HOST: '0.0.0.0' }), '0.0.0.0');
  assert.throws(() => resolveServerHost({ REPO_AUTOMATION_SCORE_HOST: 'example.com' }), /loopback or all-interface/);
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
