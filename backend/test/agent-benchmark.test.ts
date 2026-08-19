import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { resolve } from 'node:path';
import { buildImplementationReview, gradeStructure } from '../src/grade-agent-benchmark.js';
import { parseJsonLines, spawnWithCapture, summarizeEvents } from '../src/agent-benchmark-lib.js';
import { codexArguments, comparison, dockerComposeIsolationOverride, parseArguments } from '../src/run-agent-benchmark.js';
import {
  benchmarkRunnerInvocation,
  chooseRepositoryDirectory,
  composePrompt,
  createRunManager,
  discoverSkills,
  parseAgentActivity,
  providerCatalog,
  validateAutomationGuidance,
  validateRepository,
  validateRunTemporaryRoot,
} from '../src/benchmark-web-lib.js';

test('parses a bounded benchmark matrix', () => {
  assert.deepEqual(parseArguments([
    '--repo', '/tmp/app',
    '--scenario', 'tasks-page',
    '--models', 'sol,terra',
    '--reasoning-efforts', 'low,high',
    '--repetitions', '3',
    '--dry-run',
  ]), {
    keepWorktrees: false,
    skipEvaluation: false,
    skipSetup: false,
    dryRun: true,
    codexBin: process.env.CODEX_BIN ?? 'codex',
    repo: '/tmp/app',
    scenario: 'tasks-page',
    models: ['sol', 'terra'],
    reasoningEfforts: ['low', 'high'],
    repetitions: 3,
  });
  assert.throws(() => parseArguments(['--repo', '/tmp/app', '--scenario', 'x', '--repetitions', '0']), /positive integer/);
  assert.equal(parseArguments(['--repo', '/tmp/app', '--scenario', 'x', '--feature-type', 'backend']).featureType, 'backend');
  assert.throws(
    () => parseArguments(['--repo', '/tmp/app', '--scenario', 'x', '--feature-type', 'mobile']),
    /frontend, backend, or full-stack/,
  );
});

test('accepts a prepared prompt file for web-launched runs', () => {
  const options = parseArguments(['--repo', '/tmp/app', '--scenario', 'tasks-page', '--prompt-file', '/tmp/prompt.md']);
  assert.equal(options.promptFile, '/tmp/prompt.md');
});

test('uses compiled benchmark code in the production container', () => {
  assert.deepEqual(benchmarkRunnerInvocation('/app', { NODE_ENV: 'production' }), {
    command: process.execPath,
    args: ['/app/backend/dist/run-agent-benchmark.js'],
  });
  assert.deepEqual(benchmarkRunnerInvocation('/app', {}), {
    command: process.execPath,
    args: ['--import', 'tsx', '/app/backend/src/run-agent-benchmark.ts'],
  });
});

test('generates scenario-owned Docker Compose isolation deterministically', () => {
  assert.equal(dockerComposeIsolationOverride(['frontend', 'db_test']), [
    'services:',
    '  frontend:',
    '    container_name: ${BENCHMARK_RUN_ID}_frontend',
    '    ports: !reset []',
    '  db_test:',
    '    container_name: ${BENCHMARK_RUN_ID}_db_test',
    '    ports: !reset []',
    '',
  ].join('\n'));
  assert.throws(() => dockerComposeIsolationOverride([]), /at least one/);
  assert.throws(() => dockerComposeIsolationOverride(['db\nmalicious: true']), /Unsafe/);
});

test('parses JSONL and totals usage without losing the final message', () => {
  const parsed = parseJsonLines([
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'done' } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3, reasoning_output_tokens: 2 } }),
    'not-json',
  ].join('\n'));
  assert.equal(parsed.invalid.length, 1);
  assert.deepEqual(summarizeEvents(parsed.events), {
    finalMessage: 'done',
    failed: false,
    usage: { inputTokens: 10, cachedInputTokens: 4, outputTokens: 3, reasoningOutputTokens: 2 },
  });
});

test('structural grading requires every file pattern and marker', () => {
  const manifest = {
    requirements: [{
      id: 'layers',
      label: 'Layers',
      points: 10,
      files: ['backend/*availability*.ts', 'frontend/**/*.tsx'],
      contains: ['PageBody'],
    }],
  };
  const passed = gradeStructure(manifest, ['backend/availability.ts', 'frontend/Page.tsx'], 'PageBody');
  assert.equal(passed[0].earned, 10);
  const failed = gradeStructure(manifest, ['backend/availability.ts'], 'PageBody');
  assert.equal(failed[0].earned, 0);
  assert.deepEqual(failed[0].missingFiles, ['frontend/**/*.tsx']);
});

test('builds a reference-derived implementation review without scoring directory parity', () => {
  const manifest = {
    reviewSections: [{
      id: 'backend',
      label: 'Backend',
      items: [
        { id: 'services', label: 'Services', patterns: ['backend/src/services/*task*.ts'] },
        { id: 'policies', label: 'Policies', patterns: ['backend/src/policies/*task*.ts'] },
      ],
    }],
  };
  const review = buildImplementationReview(manifest, ['backend/src/services/taskService.ts'], ['backend/src/services/taskService.ts', 'backend/src/policies/taskPolicy.ts']);
  assert.deepEqual(review[0].items, [
    { id: 'services', label: 'Services', implemented: true, candidateFiles: ['backend/src/services/taskService.ts'], referenceFiles: ['backend/src/services/taskService.ts'] },
    { id: 'policies', label: 'Policies', implemented: false, candidateFiles: [], referenceFiles: ['backend/src/policies/taskPolicy.ts'] },
  ]);
});

test('the Tasks page manifest has a stable 100-point rubric', () => {
  const manifest = JSON.parse(readFileSync(resolve(
    import.meta.dirname,
    '../../benchmarks/tasks-page/manifest.json',
  ), 'utf8'));
  const scoredItems = [...manifest.checks, ...manifest.requirements];
  assert.equal(scoredItems.reduce((total, item) => total + item.points, 0), 100);
  assert.equal(new Set(scoredItems.map(item => item.id)).size, scoredItems.length);
  assert.equal(new Set(manifest.models).size, 3);
  assert.ok(manifest.models.includes('gpt-5.6-sol'));
  assert.deepEqual(manifest.reasoningEfforts, ['low', 'medium', 'high']);
  assert.equal(manifest.version, 7);
  assert.deepEqual(manifest.isolation.dockerComposeServices, ['frontend', 'nginx', 'backend', 'db', 'db_test']);
});

test('captures subprocess streams into isolated artifacts', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'agent-benchmark-test-'));
  const stdoutPath = resolve(directory, 'stdout.jsonl');
  const stderrPath = resolve(directory, 'stderr.log');
  try {
    const result = await spawnWithCapture(process.execPath, [
      '-e',
      'process.stdout.write("output\\n"); process.stderr.write("progress\\n");',
    ], {
      cwd: directory,
      env: process.env,
      timeoutMs: 5_000,
      stdoutPath,
      stderrPath,
      input: '',
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.timedOut, false);
    assert.equal(readFileSync(stdoutPath, 'utf8'), 'output\n');
    assert.equal(readFileSync(stderrPath, 'utf8'), 'progress\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('terminates a timed-out candidate process group', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'agent-benchmark-timeout-'));
  const stdoutPath = resolve(directory, 'stdout.jsonl');
  const stderrPath = resolve(directory, 'stderr.log');
  try {
    const result = await spawnWithCapture(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      cwd: directory,
      env: process.env,
      timeoutMs: 25,
      stdoutPath,
      stderrPath,
      input: '',
    });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.exitCode, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('builds a non-interactive Codex command without conflicting permission flags', () => {
  const args = codexArguments({ model: 'gpt-5.6-luna', reasoningEffort: 'medium', worktree: '/tmp/worktree', finalPath: '/tmp/final.md' });
  assert.ok(args.includes('--approve-for-me'));
  assert.equal(args.includes('--sandbox'), false);
  assert.deepEqual(args.slice(-3), ['--output-last-message', '/tmp/final.md', '-']);
});

test('reports score variance, gate reliability, and recurring misses by model and effort', () => {
  const agent = { exitCode: 0, timedOut: false, durationMs: 100, usage: { inputTokens: 10, cachedInputTokens: 8, outputTokens: 2 } };
  const rows = comparison([
    { model: 'luna', reasoningEffort: 'low', agent, grade: { percentage: 40, failedChecks: ['backend'], failedRequirements: ['workflows'] } },
    { model: 'luna', reasoningEffort: 'low', agent, grade: { percentage: 100, failedChecks: [], failedRequirements: [] } },
  ]);
  assert.equal(rows[0].minimumScore, 40);
  assert.equal(rows[0].maximumScore, 100);
  assert.equal(rows[0].meanScore, 70);
  assert.equal(rows[0].scoreStdDev, 30);
  assert.equal(rows[0].allGatesPassRate, 50);
  assert.deepEqual(rows[0].missedRequirements, { workflows: 1 });
});

test('discovers repository-local skills and reads their metadata', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'agent-benchmark-repo-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    const skillDirectory = resolve(directory, '.agents/skills/develop-feature');
    mkdirSync(skillDirectory, { recursive: true });
    writeFileSync(resolve(directory, 'AGENTS.md'), '# Agent guidance\n');
    writeFileSync(resolve(skillDirectory, 'SKILL.md'), '---\nname: develop-feature\ndescription: Build application features.\n---\n');
    assert.equal(validateRepository(directory), directory);
    assert.deepEqual(discoverSkills(directory), [{ name: 'develop-feature', description: 'Build application features.', path: resolve(skillDirectory, 'SKILL.md') }]);
    assert.equal(validateAutomationGuidance(directory).skills.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('composes an auditable feature prompt that delegates skill routing to AGENTS.md', () => {
  const prompt = composePrompt({ scenarioPrompt: '# Scenario\nDo the work.', featureType: 'frontend', description: 'Build Tasks.' });
  assert.match(prompt, /Implement frontend scope only/);
  assert.match(prompt, /Follow AGENTS\.md and let its workflow choose/);
  assert.match(prompt, /## User feature description\nBuild Tasks\./);
  assert.throws(() => composePrompt({ scenarioPrompt: 'x', description: '  ' }), /required/);
  assert.throws(() => composePrompt({ scenarioPrompt: 'x', featureType: 'mobile', description: 'Build.' }), /Unsupported feature type/);
});

test('rejects repositories without both AGENTS.md and discoverable skills', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'agent-benchmark-guidance-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    assert.throws(() => validateAutomationGuidance(directory), /AGENTS\.md is required/);
    writeFileSync(resolve(directory, 'AGENTS.md'), '# Guidance\n');
    assert.throws(() => validateAutomationGuidance(directory), /at least one SKILL\.md/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('exposes models through an agent-provider catalog', () => {
  assert.deepEqual(providerCatalog(), [{
    id: 'codex',
    label: 'Codex',
    models: [{ id: 'gpt-5.6-sol', label: 'Sol' }, { id: 'gpt-5.6-luna', label: 'Luna' }, { id: 'gpt-5.6-terra', label: 'Terra' }],
  }]);
});

test('uses a native macOS picker without interpolating shell input', () => {
  let call;
  const repo = chooseRepositoryDirectory({ platform: 'darwin', execute(command, args) { call = { command, args }; return '/tmp/example/\n'; } });
  assert.equal(repo, '/tmp/example');
  assert.deepEqual(call, { command: 'osascript', args: ['-e', 'POSIX path of (choose folder with prompt "Choose a Git repository")'] });
  assert.throws(() => chooseRepositoryDirectory({ platform: 'linux' }), /currently available on macOS/);
});

test('keeps configured run temporary storage outside the attached repository', () => {
  assert.equal(validateRunTemporaryRoot('/workspace/repository', '/runtime/repo-score'), '/runtime/repo-score');
  assert.throws(() => validateRunTemporaryRoot('/workspace/repository', '/workspace/repository/.runtime'), /outside the attached repository/);
});

test('keeps local run artifacts and databases outside version control', () => {
  const root = resolve(import.meta.dirname, '../..');
  const ignored = execFileSync('git', ['check-ignore', 'results/web-runs/example/result.json', 'run-data/example.json', 'local.sqlite'], { cwd: root, encoding: 'utf8' });
  assert.match(ignored, /results\/web-runs\/example\/result\.json/);
  assert.match(ignored, /run-data\/example\.json/);
  assert.match(ignored, /local\.sqlite/);
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
  assert.equal(tracked.some(path => /^(results|run-data|\.run-data|logs)\//.test(path)), false);
  assert.equal(tracked.some(path => /\.(?:db|sqlite|sqlite3)(?:-|$)/.test(path)), false);
});

test('run manager uses the local database instead of treating artifact folders as durable records', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'repo-score-runs-'));
  try {
    const runDirectory = resolve(root, 'results/web-runs/run-example');
    const candidateDirectory = resolve(runDirectory, 'provider-model-run-1');
    mkdirSync(candidateDirectory, { recursive: true });
    writeFileSync(resolve(runDirectory, 'web-run.json'), JSON.stringify({ id: 'run-example', createdAt: '2026-01-01T00:00:00.000Z', status: 'running' }));
    writeFileSync(resolve(runDirectory, 'runner.log'), 'preparing worktree');
    writeFileSync(resolve(candidateDirectory, 'progress.log'), 'reading repository guidance');
    writeFileSync(resolve(candidateDirectory, 'events.jsonl'), `${JSON.stringify({ type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: 'Working.' } })}\n`);
    const manager = createRunManager({ root });
    assert.equal(await manager.get('run-example'), null);
    assert.deepEqual(await manager.list(), []);
    assert.equal(existsSync(resolve(root, 'data/repo-automation-score.sqlite')), true);
    await manager.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('run manager honors the configured database path', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'repo-score-db-path-'));
  const configured = resolve(root, 'custom', 'runs.sqlite');
  const previous = process.env.REPO_AUTOMATION_SCORE_DB_PATH;
  process.env.REPO_AUTOMATION_SCORE_DB_PATH = configured;
  try {
    const manager = createRunManager({ root });
    await manager.list();
    assert.equal(existsSync(configured), true);
    assert.equal(existsSync(resolve(root, 'data/repo-automation-score.sqlite')), false);
    await manager.close();
  } finally {
    if (previous === undefined) delete process.env.REPO_AUTOMATION_SCORE_DB_PATH;
    else process.env.REPO_AUTOMATION_SCORE_DB_PATH = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('run manager normalizes a finished process before removing its temporary directory', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'repo-score-manager-'));
  const repo = mkdtempSync(resolve(tmpdir(), 'repo-score-target-'));
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  try {
    mkdirSync(resolve(root, 'benchmarks/tasks-page'), { recursive: true });
    writeFileSync(resolve(root, 'benchmarks/tasks-page/prompt.md'), '# Scenario\nBuild it.\n');
    execFileSync('git', ['init', '--quiet'], { cwd: repo });
    writeFileSync(resolve(repo, 'AGENTS.md'), '# Guidance\n');
    const skill = resolve(repo, '.agents/skills/develop-feature');
    mkdirSync(skill, { recursive: true });
    writeFileSync(resolve(skill, 'SKILL.md'), '---\nname: develop-feature\ndescription: Build features.\n---\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--quiet', '-m', 'fixture'], { cwd: repo });
    const manager = createRunManager({ root, spawnProcess: () => child });
    const run = await manager.start({ repo, provider: 'codex', model: 'gpt-5.6-luna', reasoningEffort: 'low', featureType: 'frontend', description: 'Build it.' });
    assert.equal(existsSync(run.artifactPath), true);
    child.emit('close', 1);
    for (let attempt = 0; attempt < 50 && existsSync(run.artifactPath); attempt += 1) await new Promise(resolveWait => setTimeout(resolveWait, 10));
    assert.equal(existsSync(run.artifactPath), false);
    assert.equal((await manager.get(run.id))?.status, 'failed');
    await manager.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test('agent activity collapses live event updates into a meaningful tree', () => {
  const source = [
    { type: 'item.completed', item: { id: 'message-1', type: 'agent_message', text: 'Inspecting the existing task patterns.' } },
    { type: 'item.started', item: { id: 'command-1', type: 'command_execution', command: "npm test", status: 'in_progress', exit_code: null } },
    { type: 'item.completed', item: { id: 'command-1', type: 'command_execution', command: "npm test", status: 'completed', exit_code: 0 } },
    { type: 'item.completed', item: { id: 'files-1', type: 'file_change', changes: [{ path: '/tmp/worktree/frontend/src/Tasks.tsx', kind: 'update' }], status: 'completed' } },
  ].map(event => JSON.stringify(event)).join('\n');
  const activity = parseAgentActivity(source, 'running');
  assert.equal(activity[0].status, 'running');
  assert.equal(activity.filter(item => item.id === 'command-1').length, 1);
  assert.equal(activity.find(item => item.id === 'command-1').label, 'Running tests');
  assert.match(activity.find(item => item.id === 'files-1').detail, /frontend\/src\/Tasks.tsx/);
  assert.equal(activity.some(item => item.detail.includes('private reasoning')), false);
});
