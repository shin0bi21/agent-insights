import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, resolve, sep } from 'node:path';
import DatabaseDriver from 'better-sqlite3';

export type CodexWorkerUsage = {
  externalThreadId: string;
  parentExternalThreadId: string | null;
  nickname: string | null;
  role: string | null;
  model: string | null;
  reasoningLevel: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  active: boolean;
  updatedAt: string;
};

export type CodexLiveSessionSnapshot = {
  externalId: string;
  title: string;
  repositoryName: string | null;
  status: 'active' | 'idle';
  observedAt: string;
  contextWindow: number | null;
  contextTokens: number;
  contextPercent: number | null;
  turnCount: number;
  completedTurnCount: number;
  evidence: Record<string, number>;
  guidance: {
    available: true;
    agentsReads: number;
    skillReads: number;
    skillsUsed: string[];
    promptCount: number;
    promptsWithSkillRead: number;
    averageSkillReadLatencyMs: number | null;
    currentPromptHasSkillRead: boolean | null;
  };
  workers: CodexWorkerUsage[];
};

type WorkerRow = {
  id: string;
  parent_id: string | null;
  model: string | null;
  reasoning_effort: string | null;
  agent_nickname: string | null;
  agent_role: string | null;
  rollout_path: string;
  title?: string | null;
  cwd?: string | null;
};

function token(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeRolloutPath(codexHome: string, value: string) {
  const sessionsRoot = realpathSync(resolve(codexHome, 'sessions'));
  const path = realpathSync(value);
  if (path !== sessionsRoot && !path.startsWith(`${sessionsRoot}${sep}`)) {
    throw new Error('Codex rollout path is outside the session store.');
  }
  return path;
}

type RolloutState = {
  usage: Record<string, unknown> | null;
  contextWindow: number | null;
  contextTokens: number;
  activeTurns: number;
  turnCount: number;
  completedTurnCount: number;
  evidence: Record<string, number>;
  promptTimes: number[];
  skillReadTimes: number[];
  skillsUsed: Set<string>;
  agentsReads: number;
};

type RolloutCache = { inode: number; offset: number; state: RolloutState };
const rolloutCache = new Map<string, RolloutCache>();
const rolloutScans = new Map<string, Promise<ReturnType<typeof snapshotRollout>>>();
const maximumInitialRolloutBytes = 256 * 1024 * 1024;

function emptyRolloutState(): RolloutState {
  return { usage: null, contextWindow: null, contextTokens: 0, activeTurns: 0, turnCount: 0, completedTurnCount: 0, evidence: {}, promptTimes: [], skillReadTimes: [], skillsUsed: new Set(), agentsReads: 0 };
}

function applyRolloutMessage(state: RolloutState, line: string) {
  let message: Record<string, any>;
  try { message = JSON.parse(line); } catch { return false; }
    const candidate = message?.payload?.info?.total_token_usage;
    if (candidate && typeof candidate === 'object') {
      state.usage = candidate;
      const window = message?.payload?.info?.model_context_window;
      state.contextWindow = typeof window === 'number' && Number.isSafeInteger(window) && window > 0 ? window : state.contextWindow;
      state.contextTokens = token(message?.payload?.info?.last_token_usage?.total_tokens);
    }
    const type = message?.payload?.type;
    const timestamp = Date.parse(String(message?.timestamp ?? ''));
    if (message.type === 'response_item' && type === 'message' && message?.payload?.role === 'user' && Number.isFinite(timestamp)) {
      state.promptTimes.push(timestamp);
    }
    if (message.type === 'response_item' && (type === 'custom_tool_call' || type === 'function_call')) {
      const input = String(message?.payload?.input ?? message?.payload?.arguments ?? '');
      const agentsMatches = input.match(/AGENTS\.md\b/g);
      state.agentsReads += agentsMatches?.length ?? 0;
      const matches = [...input.matchAll(/(?:\.agents|\.codex|skills)[\\/]skills[\\/](?:[^\\/"'\s]+[\\/])*([^\\/"'\s]+)[\\/]SKILL\.md/g)];
      for (const match of matches) {
        state.skillsUsed.add(match[1]);
        if (Number.isFinite(timestamp)) state.skillReadTimes.push(timestamp);
      }
    }
    if (message.type === 'event_msg' && type === 'task_started') { state.turnCount += 1; state.activeTurns += 1; }
    if (message.type === 'event_msg' && type === 'task_complete') { state.completedTurnCount += 1; state.activeTurns = Math.max(0, state.activeTurns - 1); }
    const normalized = type === 'web_search_end' ? 'webSearch'
      : type === 'patch_apply_end' ? 'fileChange'
        : type === 'sub_agent_activity' ? 'delegation'
          : type === 'context_compacted' || message.type === 'compacted' ? 'contextCompaction'
            : message.type === 'response_item' && (type === 'custom_tool_call' || type === 'function_call') ? 'toolCall'
              : null;
    if (normalized) state.evidence[normalized] = (state.evidence[normalized] ?? 0) + 1;
    return true;
}

function snapshotRollout(state: RolloutState) {
  return {
    usage: {
      inputTokens: token(state.usage?.input_tokens),
      cachedInputTokens: token(state.usage?.cached_input_tokens),
      cacheWriteInputTokens: token(state.usage?.cache_write_input_tokens),
      outputTokens: token(state.usage?.output_tokens),
      reasoningOutputTokens: token(state.usage?.reasoning_output_tokens),
      totalTokens: token(state.usage?.total_tokens),
    },
    contextWindow: state.contextWindow,
    contextTokens: state.contextTokens,
    active: state.activeTurns > 0,
    turnCount: state.turnCount,
    completedTurnCount: state.completedTurnCount,
    evidence: { ...state.evidence },
    guidance: { agentsReads: state.agentsReads, skillReadTimes: [...state.skillReadTimes], skillsUsed: [...state.skillsUsed], promptTimes: [...state.promptTimes] },
  };
}

async function scanRolloutIncrementally(path: string) {
  const metadata = statSync(path);
  if (!metadata.isFile()) throw new Error('Codex rollout is not a regular file.');
  let cached = rolloutCache.get(path);
  if (!cached || cached.inode !== metadata.ino || metadata.size < cached.offset) {
    if (metadata.size > maximumInitialRolloutBytes) throw new Error('Codex rollout exceeds the safe initial scan limit.');
    cached = { inode: metadata.ino, offset: 0, state: emptyRolloutState() };
    rolloutCache.set(path, cached);
  }
  if (metadata.size === cached.offset) return snapshotRollout(cached.state);
  let buffer = '';
  let consumedBytes = 0;
  const stream = createReadStream(path, { encoding: 'utf8', start: cached.offset, end: metadata.size - 1 });
  for await (const chunk of stream) {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      consumedBytes += Buffer.byteLength(buffer.slice(0, newline + 1));
      if (line.trim()) applyRolloutMessage(cached.state, line);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
  }
  cached.offset += consumedBytes;
  if (buffer.trim() && applyRolloutMessage(cached.state, buffer)) cached.offset = metadata.size;
  return snapshotRollout(cached.state);
}

async function scanRollout(path: string) {
  const existing = rolloutScans.get(path);
  if (existing) return existing;
  const scan = scanRolloutIncrementally(path).finally(() => rolloutScans.delete(path));
  rolloutScans.set(path, scan);
  return scan;
}

export async function readCodexWorkerUsage(externalThreadId: string, {
  codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex'),
}: { codexHome?: string } = {}): Promise<CodexWorkerUsage[]> {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(externalThreadId)) throw new Error('Invalid Codex session ID.');
  const statePath = resolve(codexHome, 'state_5.sqlite');
  if (!existsSync(statePath)) throw new Error('Codex local session state is unavailable.');
  const sqlite = new DatabaseDriver(statePath, { readonly: true, fileMustExist: true });
  try {
    const rows = sqlite.prepare(`
      WITH RECURSIVE worker_ids(id) AS (
        SELECT ?
        UNION
        SELECT edges.child_thread_id
        FROM thread_spawn_edges AS edges
        JOIN worker_ids ON worker_ids.id = edges.parent_thread_id
      )
      SELECT threads.id, CASE WHEN threads.id = ? THEN NULL ELSE parent_edge.parent_thread_id END AS parent_id,
        threads.model, threads.reasoning_effort,
        threads.agent_nickname, threads.agent_role, threads.rollout_path
      FROM worker_ids JOIN threads ON threads.id = worker_ids.id
      LEFT JOIN thread_spawn_edges AS parent_edge ON parent_edge.child_thread_id = threads.id
      ORDER BY CASE WHEN threads.id = ? THEN 0 ELSE 1 END, threads.id
    `).all(externalThreadId, externalThreadId, externalThreadId) as WorkerRow[];
    if (rows.length > 100) throw new Error('Codex session has more workers than the safe monitoring limit.');
    return Promise.all(rows.map(async row => {
      const path = safeRolloutPath(codexHome, row.rollout_path);
      const scan = await scanRollout(path);
      return {
        externalThreadId: row.id,
        parentExternalThreadId: row.parent_id,
        nickname: row.agent_nickname,
        role: row.agent_role,
        model: row.model,
        reasoningLevel: row.reasoning_effort,
        ...scan.usage,
        active: scan.active,
        updatedAt: statSync(path).mtime.toISOString(),
      };
    }));
  } finally { sqlite.close(); }
}

export async function readCodexLiveSession(externalThreadId: string, {
  codexHome = process.env.CODEX_HOME ?? resolve(homedir(), '.codex'),
}: { codexHome?: string } = {}): Promise<CodexLiveSessionSnapshot> {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(externalThreadId)) throw new Error('Invalid Codex session ID.');
  const statePath = resolve(codexHome, 'state_5.sqlite');
  if (!existsSync(statePath)) throw new Error('Codex local session state is unavailable.');
  const sqlite = new DatabaseDriver(statePath, { readonly: true, fileMustExist: true });
  try {
    const rows = sqlite.prepare(`
      WITH RECURSIVE worker_ids(id) AS (
        SELECT ?
        UNION
        SELECT edges.child_thread_id
        FROM thread_spawn_edges AS edges JOIN worker_ids ON worker_ids.id = edges.parent_thread_id
      )
      SELECT threads.id, CASE WHEN threads.id = ? THEN NULL ELSE parent_edge.parent_thread_id END AS parent_id,
        threads.model, threads.reasoning_effort,
        threads.agent_nickname, threads.agent_role, threads.rollout_path, threads.title, threads.cwd
      FROM worker_ids JOIN threads ON threads.id = worker_ids.id
      LEFT JOIN thread_spawn_edges AS parent_edge ON parent_edge.child_thread_id = threads.id
      ORDER BY CASE WHEN threads.id = ? THEN 0 ELSE 1 END, threads.id
    `).all(externalThreadId, externalThreadId, externalThreadId) as WorkerRow[];
    if (!rows.length) throw new Error('Codex session was not found in the local store.');
    if (rows.length > 100) throw new Error('Codex session has more workers than the safe monitoring limit.');
    const scans = await Promise.all(rows.map(row => scanRollout(safeRolloutPath(codexHome, row.rollout_path))));
    const workers = rows.map((row, index) => ({
      externalThreadId: row.id,
      parentExternalThreadId: row.parent_id,
      nickname: row.agent_nickname,
      role: row.agent_role,
      model: row.model,
      reasoningLevel: row.reasoning_effort,
      ...scans[index].usage,
      active: scans[index].active,
      updatedAt: statSync(safeRolloutPath(codexHome, row.rollout_path)).mtime.toISOString(),
    }));
    const evidence: Record<string, number> = {};
    for (const scan of scans) for (const [key, count] of Object.entries(scan.evidence)) evidence[key] = (evidence[key] ?? 0) + count;
    const agentsReads = scans.reduce((sum, scan) => sum + scan.guidance.agentsReads, 0);
    const skillReadTimes = scans.flatMap(scan => scan.guidance.skillReadTimes).sort((a, b) => a - b);
    const promptTimes = scans.flatMap(scan => scan.guidance.promptTimes).sort((a, b) => a - b);
    const matchedLatencies = promptTimes.flatMap((promptTime, index) => {
      const nextPrompt = promptTimes[index + 1] ?? Number.POSITIVE_INFINITY;
      const skillTime = skillReadTimes.find(value => value >= promptTime && value < nextPrompt);
      return skillTime === undefined ? [] : [skillTime - promptTime];
    });
    const latestPrompt = promptTimes.at(-1);
    const contextWindow = scans[0].contextWindow;
    const contextTokens = scans[0].contextTokens;
    return {
      externalId: externalThreadId,
      title: `Codex session ${externalThreadId.slice(0, 8)}`,
      repositoryName: rows[0].cwd ? basename(rows[0].cwd) : null,
      status: scans.some(scan => scan.active) ? 'active' : 'idle',
      observedAt: new Date().toISOString(),
      contextWindow,
      contextTokens,
      contextPercent: contextWindow ? Math.min(100, (contextTokens / contextWindow) * 100) : null,
      turnCount: scans.reduce((sum, scan) => sum + scan.turnCount, 0),
      completedTurnCount: scans.reduce((sum, scan) => sum + scan.completedTurnCount, 0),
      evidence,
      guidance: {
        available: true,
        agentsReads,
        skillReads: skillReadTimes.length,
        skillsUsed: [...new Set(scans.flatMap(scan => scan.guidance.skillsUsed))].sort(),
        promptCount: promptTimes.length,
        promptsWithSkillRead: matchedLatencies.length,
        averageSkillReadLatencyMs: matchedLatencies.length ? Math.round(matchedLatencies.reduce((sum, value) => sum + value, 0) / matchedLatencies.length) : null,
        currentPromptHasSkillRead: latestPrompt === undefined ? null : skillReadTimes.some(value => value >= latestPrompt),
      },
      workers,
    };
  } finally { sqlite.close(); }
}
