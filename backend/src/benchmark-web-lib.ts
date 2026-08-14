import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { ensureDirectory, readJson, writeJson } from './agent-benchmark-lib.js';

export const ALLOWED_EFFORTS = ['low', 'medium', 'high'];
export const AGENT_PROVIDERS = {
  codex: { id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }, { id: 'gpt-5.6-luna', label: 'Luna' }, { id: 'gpt-5.6-terra', label: 'Terra' }] },
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
  if (platform !== 'darwin') throw new Error('Native folder selection is currently available on macOS. Enter the repository path manually on this platform.');
  try {
    return execute('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a Git repository")'], { encoding: 'utf8' }).trim().replace(/\/$/, '');
  } catch (error) {
    if (error?.status === 1) throw new Error('Folder selection was cancelled.');
    throw new Error('The native folder picker could not be opened.');
  }
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

export function composePrompt({ scenarioPrompt, skill, description }) {
  const requested = String(description ?? '').trim();
  if (!requested) throw new Error('Feature description is required.');
  const skillInstruction = skill ? `\n\n## Selected repository skill\nUse the repository skill \`${skill}\` for this work.` : '';
  return `${scenarioPrompt.trim()}${skillInstruction}\n\n## User feature description\n${requested}\n`;
}

export function createRunManager({ root, spawnProcess = spawn }) {
  const runsRoot = ensureDirectory(resolve(root, 'results', 'web-runs'));
  const active = new Map();

  function list() {
    return readdirSync(runsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => get(entry.name))
      .filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function get(id) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
    const directory = resolve(runsRoot, id);
    const configPath = resolve(directory, 'web-run.json');
    if (!within(runsRoot, directory) || !existsSync(configPath)) return null;
    const config = readJson(configPath);
    const comparisonPath = resolve(directory, 'comparison.json');
    const runnerLogPath = resolve(directory, 'runner.log');
    const candidateLogs = readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => resolve(directory, entry.name, 'progress.log'))
      .filter(existsSync);
    const progressSections = [
      existsSync(runnerLogPath) ? `Runner\n${readFileSync(runnerLogPath, 'utf8')}` : '',
      ...candidateLogs.map(path => `Agent progress\n${readFileSync(path, 'utf8')}`),
    ].filter(Boolean);
    const live = active.get(id);
    const persistedStatus = config.status === 'running' ? 'interrupted' : (config.status ?? 'failed');
    return {
      ...config,
      status: live?.status ?? (existsSync(comparisonPath) ? 'completed' : persistedStatus),
      exitCode: live?.exitCode ?? config.exitCode ?? null,
      artifactPath: directory,
      progress: progressSections.join('\n\n').slice(-40_000),
      comparison: existsSync(comparisonPath) ? readJson(comparisonPath) : null,
    };
  }

  function start(input) {
    const repo = validateRepository(input.repo);
    const provider = AGENT_PROVIDERS[input.provider];
    if (!provider) throw new Error('Unsupported agent provider.');
    if (!provider.models.some(model => model.id === input.model)) throw new Error('Unsupported model for this provider.');
    if (!ALLOWED_EFFORTS.includes(input.reasoningEffort)) throw new Error('Unsupported reasoning effort.');
    const skills = discoverSkills(repo);
    if (input.skill && !skills.some(skill => skill.name === input.skill)) throw new Error('Selected skill was not found in the repository.');
    const id = `run-${new Date().toISOString().replaceAll(/[^0-9]/g, '').slice(0, 17)}-${Math.random().toString(36).slice(2, 7)}`;
    const directory = ensureDirectory(resolve(runsRoot, id));
    const scenarioPrompt = readFileSync(resolve(root, 'scenarios/tasks-page/prompt.md'), 'utf8');
    const prompt = composePrompt({ scenarioPrompt, skill: input.skill, description: input.description });
    const promptPath = resolve(directory, 'prompt.md');
    const logPath = resolve(directory, 'runner.log');
    writeFileSync(promptPath, prompt);
    writeFileSync(logPath, '');
    const config = { id, createdAt: new Date().toISOString(), status: 'running', repo, provider: provider.id, model: input.model, reasoningEffort: input.reasoningEffort, skill: input.skill || null, description: String(input.description).trim() };
    writeJson(resolve(directory, 'web-run.json'), config);
    const args = ['--import', 'tsx', resolve(root, 'backend/src/run-agent-benchmark.ts'), '--repo', repo, '--scenario', 'tasks-page', '--models', input.model, '--reasoning-efforts', input.reasoningEffort, '--repetitions', '1', '--prompt-file', promptPath, '--output-dir', directory];
    const output = writeFileSync;
    const child = spawnProcess(process.execPath, args, { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    active.set(id, { status: 'running', exitCode: null, child });
    const append = chunk => output(logPath, chunk, { flag: 'a' });
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('close', exitCode => {
      const status = exitCode === 0 ? 'completed' : 'failed';
      active.set(id, { status, exitCode, child: null });
      writeJson(resolve(directory, 'web-run.json'), { ...config, status, exitCode });
    });
    return get(id);
  }

  return { get, list, start };
}
