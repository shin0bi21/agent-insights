import { execFileSync, spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve, sep } from 'node:path';
import { writeJson } from './agent-benchmark-lib.js';
import { createDatabase } from './db/client.js';
import { databasePath } from './db/config.js';
import { migrate } from './db/migrator.js';
import { createRunPersistence } from './services/run-persistence.js';

export const ALLOWED_EFFORTS = ['low', 'medium', 'high'];
export const ALLOWED_FEATURE_TYPES = ['frontend', 'backend', 'full-stack'];
export const AGENT_PROVIDERS = {
  codex: {
    id: 'codex',
    label: 'Codex',
    models: [
      { id: 'gpt-5.6-sol', label: 'Sol' },
      { id: 'gpt-5.6-luna', label: 'Luna' },
      { id: 'gpt-5.6-terra', label: 'Terra' },
    ],
  },
};

export function providerCatalog() {
  return Object.values(AGENT_PROVIDERS).map(provider => ({ ...provider }));
}

function within(parent, child) {
  const prefix = `${resolve(parent)}${sep}`;
  return resolve(child) === resolve(parent) || resolve(child).startsWith(prefix);
}

export function validateRepository(repoPath) {
  const path = resolve(String(repoPath ?? ''));
  if (!repoPath || !existsSync(path) || !statSync(path).isDirectory()) throw new Error('Repository directory does not exist.');
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: path, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error('Selected directory is not a Git repository.');
  }
  return path;
}

export function chooseRepositoryDirectory({ platform = process.platform, execute = execFileSync } = {}) {
  if (platform !== 'darwin') {
    throw new Error(
      'Native folder selection is currently available on macOS. Enter the repository path manually on this platform.',
    );
  }
  try {
    return execute('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a Git repository")'], { encoding: 'utf8' }).trim().replace(/\/$/, '');
  } catch (error) {
    if (error?.status === 1) throw new Error('Folder selection was cancelled.');
    throw new Error('The native folder picker could not be opened.');
  }
}

export function validateRunTemporaryRoot(repo, temporaryRoot = tmpdir()) {
  const resolvedRoot = resolve(temporaryRoot);
  if (within(repo, resolvedRoot)) {
    throw new Error('Run temporary storage must be outside the attached repository.');
  }
  return resolvedRoot;
}

function skillMetadata(skillPath) {
  const source = readFileSync(skillPath, 'utf8');
  const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/);
  const field = name => frontmatter?.[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
  return { name: field('name') || basename(dirname(skillPath)), description: field('description'), path: skillPath };
}

export function discoverSkills(repoPath) {
  const repo = validateRepository(repoPath);
  const roots = ['.agents/skills', '.codex/skills'].map(path => resolve(repo, path)).filter(existsSync);
  return roots.flatMap(root => readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => resolve(root, entry.name, 'SKILL.md'))
    .filter(path => existsSync(path) && within(repo, path))
    .map(skillMetadata));
}

export function validateAutomationGuidance(repoPath) {
  const repo = validateRepository(repoPath);
  const agentsPath = resolve(repo, 'AGENTS.md');
  if (!existsSync(agentsPath) || !statSync(agentsPath).isFile()) {
    throw new Error('Repository is not automation-ready: AGENTS.md is required.');
  }
  const skills = discoverSkills(repo);
  if (!skills.length) {
    throw new Error(
      'Repository is not automation-ready: add at least one SKILL.md under .agents/skills or .codex/skills.',
    );
  }
  return { repo, skills };
}

export function composePrompt({ scenarioPrompt, featureType = 'full-stack', description }) {
  const requested = String(description ?? '').trim();
  if (!requested) throw new Error('Feature description is required.');
  if (!ALLOWED_FEATURE_TYPES.includes(featureType)) throw new Error('Unsupported feature type.');
  let scope = 'Implement the complete full-stack scope, including persistence, backend API, and frontend behavior.';
  if (featureType === 'frontend') {
    scope = 'Implement frontend scope only. Assume the required backend contracts already exist.';
  } else if (featureType === 'backend') {
    scope = 'Implement backend scope only. Assume the frontend consumer already exists.';
  }
  return [
    scenarioPrompt.trim(),
    `## Requested feature scope\n${scope}`,
    'Follow AGENTS.md and let its workflow choose the applicable repository skill. Do not guess when repository guidance is missing.',
    `## User feature description\n${requested}`,
  ].join('\n\n') + '\n';
}

function compactText(value, limit = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function activityLabel(item) {
  if (item.type === 'agent_message') return 'Agent update';
  if (item.type === 'file_change') {
    const count = item.changes?.length ?? 0;
    const action = item.status === 'in_progress' ? 'Updating' : 'Updated';
    return `${action} ${count} ${count === 1 ? 'file' : 'files'}`;
  }
  const command = String(item.command ?? '');
  if (/\b(test|vitest|jest|playwright)\b/i.test(command)) return 'Running tests';
  if (/\b(build|tsc)\b/i.test(command)) return 'Checking the build';
  if (/\b(rg|grep|find|sed|head|tail)\b/i.test(command)) return 'Inspecting repository patterns';
  return item.status === 'in_progress' ? 'Running a command' : 'Command completed';
}

export function parseAgentActivity(source, runStatus = 'completed') {
  const items = new Map();
  for (const line of String(source ?? '').split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    const item = event.item;
    if (!item?.id || !['agent_message', 'command_execution', 'file_change'].includes(item.type)) continue;
    let status = 'completed';
    if (item.type !== 'agent_message') {
      if (item.status === 'in_progress') status = 'running';
      else if ((item.exit_code && item.exit_code !== 0) || item.status === 'failed') status = 'failed';
    }
    let detail = '';
    if (item.type === 'agent_message') detail = compactText(item.text, 500);
    if (item.type === 'command_execution') detail = compactText(item.command);
    if (item.type === 'file_change') {
      detail = (item.changes ?? [])
        .map(change => `${change.kind}: ${String(change.path).split('/').slice(-4).join('/')}`)
        .join('\n');
    }
    items.set(item.id, { id: item.id, parentId: 'agent-work', kind: item.type, label: activityLabel(item), detail, status });
  }
  const children = [...items.values()].slice(-50);
  if (!children.length) return [];
  const failed = children.some(item => item.status === 'failed');
  const status = runStatus === 'running' || children.some(item => item.status === 'running') ? 'running' : failed ? 'failed' : 'completed';
  return [{ id: 'agent-work', parentId: null, kind: 'phase', label: 'Agent work', detail: '', status }, ...children];
}

export function benchmarkRunnerInvocation(root, environment = process.env) {
  if (environment.NODE_ENV === 'production') {
    return { command: process.execPath, args: [resolve(root, 'backend/dist/run-agent-benchmark.js')] };
  }
  return { command: process.execPath, args: ['--import', 'tsx', resolve(root, 'backend/src/run-agent-benchmark.ts')] };
}

function readFileTail(path, maximumBytes = 1_000_000) {
  const size = statSync(path).size;
  const length = Math.min(size, maximumBytes);
  const buffer = Buffer.alloc(length);
  const descriptor = openSync(path, 'r');
  try { readSync(descriptor, buffer, 0, length, size - length); }
  finally { closeSync(descriptor); }
  return buffer.toString('utf8');
}

export function createRunManager({ root, spawnProcess = spawn }) {
  const databaseFile = databasePath(root);
  migrate({ path: databaseFile });
  const database = createDatabase(databaseFile);
  const persistence = createRunPersistence(database);
  const active = new Map();
  const ready = database
    .updateTable('runs')
    .set({ status: 'interrupted', completed_at: new Date().toISOString() })
    .where('status', 'in', ['queued', 'preparing', 'running', 'evaluating'])
    .execute();

  async function list() {
    await ready;
    const stored = await persistence.listRuns();
    return Promise.all(stored.map(run => active.has(run.id) ? get(run.id) : run));
  }

  async function get(id) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
    await ready;
    const stored = await persistence.getRun(id);
    if (!stored) return null;
    const live = active.get(id);
    if (!live) return { ...stored, progress: '', activity: [] };
    const directory = live.directory;
    const runnerLogPath = resolve(directory, 'runner.log');
    const candidateLogs = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => resolve(directory, entry.name, 'progress.log'))
      .filter(existsSync);
    const eventLogs = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => resolve(directory, entry.name, 'events.jsonl'))
      .filter(existsSync);
    const progressSections = [
      existsSync(runnerLogPath) ? `Runner\n${readFileSync(runnerLogPath, 'utf8')}` : '',
      ...candidateLogs.map(path => `Agent progress\n${readFileSync(path, 'utf8')}`),
    ].filter(Boolean);
    const status = live.status;
    return {
      ...stored,
      repo: live.repo,
      status,
      exitCode: live.exitCode,
      artifactPath: directory,
      progress: progressSections.join('\n\n').slice(-40_000),
      activity: eventLogs.flatMap(path => parseAgentActivity(readFileTail(path), status)),
    };
  }

  async function start(input) {
    await ready;
    const { repo } = validateAutomationGuidance(input.repo);
    const provider = AGENT_PROVIDERS[input.provider];
    if (!provider) throw new Error('Unsupported agent provider.');
    if (!provider.models.some(model => model.id === input.model)) throw new Error('Unsupported model for this provider.');
    if (!ALLOWED_EFFORTS.includes(input.reasoningEffort)) throw new Error('Unsupported reasoning effort.');
    if (!ALLOWED_FEATURE_TYPES.includes(input.featureType)) throw new Error('Unsupported feature type.');
    const id = `run-${new Date().toISOString().replaceAll(/[^0-9]/g, '').slice(0, 17)}-${Math.random().toString(36).slice(2, 7)}`;
    const directory = mkdtempSync(resolve(validateRunTemporaryRoot(repo), `repo-automation-score-${id}-`));
    const scenarioPrompt = readFileSync(resolve(root, 'scenarios/tasks-page/prompt.md'), 'utf8');
    const prompt = composePrompt({ scenarioPrompt, featureType: input.featureType, description: input.description });
    const promptPath = resolve(directory, 'prompt.md');
    const logPath = resolve(directory, 'runner.log');
    writeFileSync(promptPath, prompt);
    writeFileSync(logPath, '');
    const config = {
      id,
      createdAt: new Date().toISOString(),
      status: 'running',
      repo,
      provider: provider.id,
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      featureType: input.featureType,
      description: String(input.description).trim(),
    };
    writeJson(resolve(directory, 'web-run.json'), config);
    const baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
    await persistence.createRun({
      id,
      repositoryName: basename(repo),
      baseRevision,
      featureType: input.featureType,
      description: config.description,
      preparedPrompt: prompt,
      promptTemplateVersion: 'tasks-page:v1',
      evaluationTemplate: 'tasks-page',
      provider: provider.id,
      agent: input.model,
      reasoningLevel: input.reasoningEffort,
      createdAt: config.createdAt,
    });
    await persistence.updateRunStatus(id, 'running');
    const invocation = benchmarkRunnerInvocation(root);
    const args = [
      ...invocation.args,
      '--repo', repo,
      '--scenario', 'tasks-page',
      '--feature-type', input.featureType,
      '--models', input.model,
      '--reasoning-efforts', input.reasoningEffort,
      '--repetitions', '1',
      '--prompt-file', promptPath,
      '--output-dir', directory,
    ];
    const output = writeFileSync;
    const child = spawnProcess(invocation.command, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    active.set(id, { status: 'running', exitCode: null, child, directory, repo });
    const append = chunk => output(logPath, chunk, { flag: 'a' });
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('close', async exitCode => {
      const status = exitCode === 0 ? 'completed' : 'failed';
      active.set(id, { status, exitCode, child: null, directory, repo });
      writeJson(resolve(directory, 'web-run.json'), { ...config, status, exitCode });
      try {
        await persistence.importRun(directory, { replaceExisting: true });
        active.delete(id);
        rmSync(directory, { recursive: true, force: true });
      } catch (error) {
        await persistence.updateRunStatus(id, 'failed');
        console.error(`Could not normalize run ${id}; temporary evidence retained at ${directory}.`, error);
      }
    });
    return await get(id);
  }

  return { get, list, start, close: () => database.destroy() };
}
