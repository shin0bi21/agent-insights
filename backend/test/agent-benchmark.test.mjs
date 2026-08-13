import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { resolve } from 'node:path';
import { gradeStructure } from '../src/grade-agent-benchmark.mjs';
import { parseJsonLines, spawnWithCapture, summarizeEvents } from '../src/agent-benchmark-lib.mjs';
import { codexArguments, comparison, parseArguments } from '../src/run-agent-benchmark.mjs';
import { chooseRepositoryDirectory, composePrompt, discoverSkills, providerCatalog, validateRepository } from '../src/benchmark-web-lib.mjs';

test('parses a bounded benchmark matrix', () => {
  assert.deepEqual(parseArguments([
    '--repo', '/tmp/app', '--scenario', 'tasks-page', '--models', 'sol,terra', '--reasoning-efforts', 'low,high', '--repetitions', '3', '--dry-run',
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
});

test('accepts a prepared prompt file for web-launched runs', () => {
  const options = parseArguments(['--repo', '/tmp/app', '--scenario', 'tasks-page', '--prompt-file', '/tmp/prompt.md']);
  assert.equal(options.promptFile, '/tmp/prompt.md');
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
  const manifest = { requirements: [{ id: 'layers', label: 'Layers', points: 10, files: ['backend/*availability*.ts', 'frontend/**/*.tsx'], contains: ['PageBody'] }] };
  const passed = gradeStructure(manifest, ['backend/availability.ts', 'frontend/Page.tsx'], 'PageBody');
  assert.equal(passed[0].earned, 10);
  const failed = gradeStructure(manifest, ['backend/availability.ts'], 'PageBody');
  assert.equal(failed[0].earned, 0);
  assert.deepEqual(failed[0].missingFiles, ['frontend/**/*.tsx']);
});

test('the Tasks page manifest has a stable 100-point rubric', () => {
  const manifest = JSON.parse(readFileSync(resolve(
    import.meta.dirname,
    '../../scenarios-and-docs/scenarios/tasks-page/manifest.json',
  ), 'utf8'));
  const scoredItems = [...manifest.checks, ...manifest.requirements];
  assert.equal(scoredItems.reduce((total, item) => total + item.points, 0), 100);
  assert.equal(new Set(scoredItems.map(item => item.id)).size, scoredItems.length);
  assert.equal(new Set(manifest.models).size, 3);
  assert.ok(manifest.models.includes('gpt-5.6-sol'));
  assert.deepEqual(manifest.reasoningEfforts, ['low', 'medium', 'high']);
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
    writeFileSync(resolve(skillDirectory, 'SKILL.md'), '---\nname: develop-feature\ndescription: Build application features.\n---\n');
    assert.equal(validateRepository(directory), directory);
    assert.deepEqual(discoverSkills(directory), [{ name: 'develop-feature', description: 'Build application features.', path: resolve(skillDirectory, 'SKILL.md') }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('composes an auditable feature prompt with the selected skill', () => {
  const prompt = composePrompt({ scenarioPrompt: '# Scenario\nDo the work.', skill: 'develop-feature', description: 'Build Tasks.' });
  assert.match(prompt, /Use the repository skill `develop-feature`/);
  assert.match(prompt, /## User feature description\nBuild Tasks\./);
  assert.throws(() => composePrompt({ scenarioPrompt: 'x', description: '  ' }), /required/);
});

test('exposes models through an agent-provider catalog', () => {
  assert.deepEqual(providerCatalog(), [{
    id: 'codex',
    label: 'Codex',
    models: [{ id: 'gpt-5.6-luna', label: 'Luna' }, { id: 'gpt-5.6-terra', label: 'Terra' }],
  }]);
});

test('uses a native macOS picker without interpolating shell input', () => {
  let call;
  const repo = chooseRepositoryDirectory({ platform: 'darwin', execute(command, args) { call = { command, args }; return '/tmp/example/\n'; } });
  assert.equal(repo, '/tmp/example');
  assert.deepEqual(call, { command: 'osascript', args: ['-e', 'POSIX path of (choose folder with prompt "Choose a Git repository")'] });
  assert.throws(() => chooseRepositoryDirectory({ platform: 'linux' }), /currently available on macOS/);
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
