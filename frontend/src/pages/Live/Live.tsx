import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import FloatingSelect from '../../common/components/FloatingSelect/FloatingSelect';
import LoadingSpinner from '../../common/components/LoadingSpinner/LoadingSpinner';
import type { LiveSessionSnapshot, SessionReview, StoredCodexSession } from '../../types';
import { eyebrowClass, mutedTextClass, pageTitleClass, panelClass } from '../../ui';

const buttonClass = 'rounded-lg bg-[#6f56d9] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 dark:bg-[#a58cff] dark:text-[#17131f]';
const secondaryButtonClass = 'rounded-lg border border-[#c8c1df] px-4 py-2.5 text-sm font-semibold dark:border-[#4d455e]';
const number = new Intl.NumberFormat();
type WorkerRange = 'active' | 'today' | 'week' | 'month' | 'all';
type SessionRange = 'five' | 'hour' | 'day' | 'week' | 'month' | 'all';

function startOfDay(date = new Date()) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function workerInRange(worker: LiveSessionSnapshot['workers'][number], range: WorkerRange, now = new Date()) {
  if (range === 'active') return worker.active;
  if (range === 'all') return true;
  const updated = new Date(worker.updatedAt).getTime();
  const today = startOfDay(now);
  if (range === 'today') return updated >= today.getTime();
  if (range === 'week') { const week = new Date(today); week.setDate(week.getDate() - week.getDay()); return updated >= week.getTime(); }
  const month = new Date(today.getFullYear(), today.getMonth(), 1);
  return updated >= month.getTime();
}
function sessionInRange(session: StoredCodexSession, range: SessionRange, now = Date.now()) {
  if (range === 'all') return true;
  const updated = session.updatedAt ? new Date(session.updatedAt).getTime() : 0;
  const windows = { five: 5 * 60_000, hour: 60 * 60_000, day: 24 * 60 * 60_000, week: 7 * 24 * 60 * 60_000, month: 30 * 24 * 60 * 60_000 };
  return updated > 0 && updated >= now - windows[range];
}
function relativeActivity(session: StoredCodexSession, now = Date.now()) {
  if (!session.updatedAt) return 'Activity time unavailable';
  const elapsed = Math.max(0, now - new Date(session.updatedAt).getTime());
  if (elapsed < 60_000) return 'Active less than a minute ago';
  if (elapsed < 60 * 60_000) return `Active ${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000) return `Active ${Math.floor(elapsed / (60 * 60_000))}h ago`;
  if (elapsed < 30 * 24 * 60 * 60_000) return `Active ${Math.floor(elapsed / (24 * 60 * 60_000))}d ago`;
  return `Last active ${new Date(session.updatedAt).toLocaleDateString()}`;
}
function cacheHitRate(inputTokens: number, cachedInputTokens: number) {
  return inputTokens > 0 ? `${((Math.min(cachedInputTokens, inputTokens) / inputTokens) * 100).toFixed(1)}%` : 'Unavailable';
}
function openingKindLabel(kind: LiveSessionSnapshot['directives']['episodes'][number]['openingKind']) {
  if (kind === 'mixed') return 'Question + change request';
  if (kind === 'question') return 'Question that led to changes';
  if (kind === 'approval') return 'Approval that led to changes';
  if (kind === 'correction') return 'Correction that led to changes';
  if (kind === 'context') return 'Context that led to changes';
  return 'Change request';
}

function reviewSnapshot(review: SessionReview): LiveSessionSnapshot {
  const observedAt = review.completedAt ?? review.startedAt ?? new Date(0).toISOString();
  return {
    externalId: review.externalSessionId,
    title: review.title ?? 'Stored session',
    repositoryName: review.repositoryName,
    status: review.status,
    observedAt,
    contextWindow: null,
    contextTokens: 0,
    contextPercent: null,
    turnCount: review.turnCount,
    completedTurnCount: review.status === 'completed' ? review.turnCount : 0,
    evidence: review.evidence,
    guidance: { available: false, agentsReads: 0, skillReads: 0, skillsUsed: [], promptCount: 0, promptsWithSkillRead: 0, averageSkillReadLatencyMs: null, currentPromptHasSkillRead: null },
    offload: review.offload ?? { available: false, shellBatches: 0, candidateBatches: 0, associatedInputTokens: 0, associatedCachedInputTokens: 0, associatedOutputTokens: 0, associatedTotalTokens: 0, categories: { verification: 0, build: 0, formatting: 0, script: 0, monitoring: 0 }, processPatterns: [] },
    directives: review.directives ?? { available: false, classifierVersion: 2, episodes: [] },
    workers: review.workerUsage.map(worker => ({
      externalThreadId: worker.id,
      parentExternalThreadId: worker.role === 'orchestrator' ? null : 'subagent',
      nickname: worker.name,
      role: worker.role,
      model: worker.model,
      reasoningLevel: worker.reasoningLevel,
      inputTokens: worker.inputTokens ?? 0,
      cachedInputTokens: worker.cachedInputTokens ?? 0,
      cacheWriteInputTokens: worker.cacheWriteInputTokens ?? 0,
      outputTokens: worker.outputTokens ?? 0,
      reasoningOutputTokens: worker.reasoningOutputTokens ?? 0,
      totalTokens: worker.totalTokens,
      active: false,
      updatedAt: observedAt,
    })),
  };
}

export default function Live({ embedded = false }: { embedded?: boolean }) {
  const [sessions, setSessions] = useState<StoredCodexSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [snapshot, setSnapshot] = useState<LiveSessionSnapshot | null>(null);
  const [watching, setWatching] = useState(false);
  const [snapshotMode, setSnapshotMode] = useState<'live' | 'static' | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [workerRange, setWorkerRange] = useState<WorkerRange>('today');
  const [sessionRange, setSessionRange] = useState<SessionRange>('five');
  const [sessionQuery, setSessionQuery] = useState('');
  const [expandedUsage, setExpandedUsage] = useState<Record<'Main agent' | 'Subagents', boolean>>({ 'Main agent': false, Subagents: false });
  const dashboardRef = useRef<HTMLElement>(null);
  const scrollOnNextSnapshot = useRef(false);

  useEffect(() => {
    let active = true;
    api.storedCodexSessions().then(items => {
      if (!active) return;
      setSessions(items); setSelectedId(items.find(item => sessionInRange(item, 'five'))?.externalId ?? '');
    }).catch(error => active && setMessage((error as Error).message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!watching || !selectedId) return;
    let active = true;
    let inFlight = false;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await api.liveCodexSession(selectedId);
        if (active) { setSnapshot(next); setSnapshotMode('live'); setMessage(''); }
      } catch (error) {
        if (active) { setMessage((error as Error).message); setWatching(false); }
      } finally { if (active) setDashboardLoading(false); inFlight = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedId, watching]);

  useEffect(() => {
    if (!snapshot || !scrollOnNextSnapshot.current) return;
    scrollOnNextSnapshot.current = false;
    dashboardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [snapshot]);

  useEffect(() => {
    if (!dashboardLoading || !scrollOnNextSnapshot.current) return;
    dashboardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [dashboardLoading]);

  async function generateReview() {
    if (!selectedId) return;
    setWatching(false); setDashboardLoading(true); setMessage('Generating a static review…');
    try {
      const saved = await api.importCodexSession(selectedId);
      setSnapshot(reviewSnapshot(saved)); setSnapshotMode('static');
      setMessage('Static review generated from durable SQLite evidence.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setDashboardLoading(false); }
  }

  const visibleWorkers = snapshot?.workers.filter(worker => workerInRange(worker, workerRange)) ?? [];
  const totalTokens = visibleWorkers.reduce((sum, worker) => sum + worker.totalTokens, 0);
  const totalInputTokens = visibleWorkers.reduce((sum, worker) => sum + worker.inputTokens, 0);
  const totalCachedInputTokens = visibleWorkers.reduce((sum, worker) => sum + worker.cachedInputTokens, 0);
  const usageGroups = [...visibleWorkers.reduce((groups, worker) => {
    const scope = worker.parentExternalThreadId === null ? 'Main agent' : 'Subagents';
    const key = `${scope}:${worker.model ?? 'Unattributed'}:${worker.reasoningLevel ?? 'unknown'}`;
    const current = groups.get(key) ?? { key, scope, model: worker.model ?? 'Unattributed', reasoning: worker.reasoningLevel ?? 'unknown', workers: 0, inputTokens: 0, cachedInputTokens: 0, totalTokens: 0, outputTokens: 0, running: 0 };
    current.workers += 1; current.inputTokens += worker.inputTokens; current.cachedInputTokens += worker.cachedInputTokens; current.totalTokens += worker.totalTokens; current.outputTokens += worker.outputTokens; current.running += worker.active ? 1 : 0;
    groups.set(key, current); return groups;
  }, new Map<string, { key: string; scope: string; model: string; reasoning: string; workers: number; inputTokens: number; cachedInputTokens: number; totalTokens: number; outputTokens: number; running: number }>()).values()];
  const usageTotals = (['Main agent', 'Subagents'] as const).map(scope => {
    const workers = visibleWorkers.filter(worker => (worker.parentExternalThreadId === null ? 'Main agent' : 'Subagents') === scope);
    return {
      scope,
      workers: workers.length,
      running: workers.filter(worker => worker.active).length,
      inputTokens: workers.reduce((sum, worker) => sum + worker.inputTokens, 0),
      cachedInputTokens: workers.reduce((sum, worker) => sum + worker.cachedInputTokens, 0),
      totalTokens: workers.reduce((sum, worker) => sum + worker.totalTokens, 0),
      outputTokens: workers.reduce((sum, worker) => sum + worker.outputTokens, 0),
      details: usageGroups.filter(group => group.scope === scope),
    };
  }).filter(group => group.workers > 0);
  const normalizedQuery = sessionQuery.trim().toLowerCase();
  const visibleSessions = sessions.filter(session => sessionInRange(session, sessionRange) && (!normalizedQuery || `${session.title} ${session.repositoryName ?? ''}`.toLowerCase().includes(normalizedQuery)));
  const directiveEpisodes = snapshot?.directives?.episodes ?? [];
  const directivePreparationQuestions = directiveEpisodes.reduce((sum, episode) => sum + episode.preparation.questions, 0);
  const directiveVerifications = directiveEpisodes.filter(episode => episode.execution.verificationBatches > 0).length;
  const patternTimingEpisodes = directiveEpisodes.filter(episode => episode.discovery.patternBeforeFirstChange !== null);
  const patternsBeforeChange = patternTimingEpisodes.filter(episode => episode.discovery.patternBeforeFirstChange).length;
  return (
    <section className={embedded ? undefined : 'mx-auto max-w-[1100px]'} aria-labelledby="live-title">
      {embedded
        ? <p className={`mb-5 ${mutedTextClass}`} id="live-title">Monitor an existing session or review a completed session.</p>
        : <><p className={eyebrowClass}>LIVE SESSION</p><h2 className={pageTitleClass} id="live-title">Watch work in progress</h2><p className={`mb-7 max-w-[760px] leading-7 ${mutedTextClass}`}>Select a Codex thread already on this machine. Monitoring reads normalized local telemetry only; it does not start a turn or spend tokens.</p></>}
      {message && <p className="mb-5 rounded-lg border border-[#dedbea] bg-white p-4 text-sm dark:border-[#373241] dark:bg-[#1b1921]" role="status">{message}</p>}
      <section className={`${panelClass} p-6`} aria-labelledby="connection-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="connection-title">Sessions</h3><p className={`mt-1 text-sm ${mutedTextClass}`}>{visibleSessions.length} sessions in this activity period</p></div><div className="w-[190px]"><label className="sr-only" htmlFor="session-range">Session activity period</label><FloatingSelect id="session-range" value={sessionRange} options={[{ value: 'five', label: 'Last 5 minutes' }, { value: 'hour', label: 'Last hour' }, { value: 'day', label: 'Last 24 hours' }, { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' }, { value: 'all', label: 'All time' }]} onChange={value => setSessionRange(value as SessionRange)} /></div></div>
        <label className="sr-only" htmlFor="session-search">Search session history</label><input id="session-search" className="mt-4 w-full rounded-lg border border-[#c8c1df] bg-white px-4 py-3 text-sm outline-offset-2 focus-visible:outline-3 focus-visible:outline-[#6f56d9]/32 dark:border-[#4d455e] dark:bg-[#1b1921]" type="search" value={sessionQuery} onChange={event => setSessionQuery(event.target.value)} placeholder="Search by session title or repository" />
        <div className="mt-4 grid max-h-[360px] gap-2 overflow-y-auto pr-1" aria-label="Recent Codex sessions">
          {loading && <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#c8c1df] p-5 dark:border-[#4d455e]" aria-label="Loading sessions" role="status"><LoadingSpinner /><strong className="text-sm">Loading sessions…</strong><span className={`text-xs ${mutedTextClass}`}>Reading stored Codex threads.</span></div>}
          {!loading && visibleSessions.map(session => <button className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl border p-4 text-left ${selectedId === session.externalId ? 'border-[#6f56d9] bg-[#f4f1fc] dark:border-[#a58cff] dark:bg-[#27222f]' : 'border-[#dedbea] dark:border-[#373241]'}`} key={session.externalId} onClick={() => { setSelectedId(session.externalId); setSnapshot(null); setSnapshotMode(null); setWatching(false); setDashboardLoading(false); }} type="button"><span><strong className="line-clamp-1 block text-sm">{session.title}</strong><span className={`mt-1 block text-xs ${mutedTextClass}`}>{session.repositoryName ?? 'No repository'} · {session.source}</span></span><span className={`text-xs font-semibold ${mutedTextClass}`}>{relativeActivity(session)}</span></button>)}
          {!loading && !visibleSessions.length && <div className="rounded-xl border border-dashed border-[#c8c1df] p-5 text-sm dark:border-[#4d455e]"><strong>No matching recent sessions</strong><p className={`mt-2 ${mutedTextClass}`}>Clear the search or choose a wider recent-activity period.</p></div>}
        </div>
        <div className={`mt-4 flex flex-wrap items-center gap-3 ${embedded ? 'justify-end' : 'justify-between'}`}>
          {!embedded && <p className={`text-xs ${mutedTextClass}`}>{selectedId ? 'Use this same dashboard as a live view or a frozen review.' : 'Select a session to continue.'}</p>}
          <div className="flex gap-2"><button className={buttonClass} disabled={!selectedId || loading} onClick={() => { if (watching) { setWatching(false); setDashboardLoading(false); scrollOnNextSnapshot.current = false; } else { scrollOnNextSnapshot.current = true; setDashboardLoading(true); setSnapshotMode('live'); setWatching(true); } }} type="button">{watching ? 'Pause watching' : snapshotMode === 'live' ? 'Resume watching' : 'Start watching'}</button><button className={secondaryButtonClass} disabled={!selectedId || loading || dashboardLoading} onClick={() => void generateReview()} type="button">Generate static review</button></div>
        </div>
      </section>
      {dashboardLoading && <section className={`${panelClass} mt-6 scroll-mt-6 p-10`} aria-live="polite" aria-label="Loading session information" ref={dashboardRef} role="status"><div className="flex flex-col items-center justify-center gap-3"><LoadingSpinner size="lg" /><strong>Loading session information…</strong><span className={`text-xs ${mutedTextClass}`}>Reading normalized local telemetry.</span></div></section>}
      {snapshot && !dashboardLoading && <>
        <section className={`${panelClass} mt-6 scroll-mt-6 p-6`} aria-labelledby="health-title" ref={dashboardRef}>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 id="health-title">{snapshot.title}</h3><p className={`mt-1 text-sm ${mutedTextClass}`}>{snapshot.repositoryName ?? 'No repository'}</p></div><span className="rounded-full bg-[#f4f1fc] px-3 py-1 text-xs font-semibold dark:bg-[#27222f]">{snapshot.status}</span></div>
          <div className="mt-6 grid grid-cols-5 gap-3 max-[900px]:grid-cols-2">{[
            ['Context', snapshot.contextPercent === null ? 'Unavailable' : `${snapshot.contextPercent.toFixed(1)}%`], ['Cache hit rate', cacheHitRate(totalInputTokens, totalCachedInputTokens)], ['Visible worker tokens', number.format(totalTokens)], ['Visible workers', visibleWorkers.length], ['Turns', `${snapshot.completedTurnCount}/${snapshot.turnCount}`],
          ].map(([label, value]) => <div className="rounded-xl bg-[#f4f1fc] p-4 dark:bg-[#27222f]" key={label}><strong className="block text-2xl">{value}</strong><span className={`text-xs ${mutedTextClass}`}>{label}</span></div>)}</div>
          {snapshot.contextPercent !== null && <div className="mt-5"><div className="h-2 overflow-hidden rounded-full bg-[#e4dfef] dark:bg-[#373241]"><div className="h-full rounded-full bg-[#6f56d9] dark:bg-[#a58cff]" style={{ width: `${snapshot.contextPercent}%` }} /></div><p className={`mt-2 text-xs ${mutedTextClass}`}>{number.format(snapshot.contextTokens)} of {number.format(snapshot.contextWindow ?? 0)} tokens in the current context window.</p></div>}
        </section>
        <section className={`${panelClass} mt-4 p-4`} aria-labelledby="directives-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h3 id="directives-title">Directive episodes</h3>{snapshot.directives?.available && <p className={`text-xs ${mutedTextClass}`}>{directiveEpisodes.length} change-backed · {directivePreparationQuestions} prep questions · {directiveVerifications}/{directiveEpisodes.length} with verification runs{patternTimingEpisodes.length ? ` · ${patternsBeforeChange}/${patternTimingEpisodes.length} pattern-first` : ''}</p>}</div>
          {!snapshot.directives?.available && <p className={`mt-1 text-xs ${mutedTextClass}`}>Directive episodes are unavailable in this review.</p>}
          {snapshot.directives?.available && <>
            <p className={`mt-1 text-[11px] ${mutedTextClass}`}>Main-agent rollout only, newest first. Expand a row for preparation and discovery details.</p>
            <div className="mt-3 grid max-h-[218px] gap-1.5 overflow-y-auto pr-1" aria-label="Change-backed directives, newest first" role="region">{directiveEpisodes.slice().reverse().map(episode => {
              const patternSignal = episode.discovery.patternBeforeFirstChange === true ? 'Pattern found before editing' : episode.discovery.patternBeforeFirstChange === false ? 'Pattern found after editing' : 'No pattern timing observed';
              return <details className="group rounded-xl border border-[#dedbea] dark:border-[#373241]" key={episode.key}>
                <summary className="grid min-h-[66px] cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2 marker:hidden">
                  <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-90">▶</span>
                  <span className="min-w-0"><span className="flex items-center gap-2"><strong className="shrink-0">Directive {episode.sequenceNumber}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${episode.execution.verificationBatches ? 'bg-[#e8f6eb] text-[#236534] dark:bg-[#203a28] dark:text-[#9ce0ad]' : 'bg-[#fff2d8] text-[#7a4b00] dark:bg-[#493716] dark:text-[#ffd58a]'}`}>{episode.execution.verificationBatches ? `${episode.execution.verificationBatches} verification run${episode.execution.verificationBatches === 1 ? '' : 's'}` : 'no verification run'}</span></span><span className={`mt-0.5 block truncate text-[11px] ${mutedTextClass}`}>{openingKindLabel(episode.openingKind)} · {episode.context.percentAtStart === null ? 'context unavailable' : `${episode.context.percentAtStart.toFixed(1)}% context`} · {cacheHitRate(episode.usageAtStart.inputTokens, episode.usageAtStart.cachedInputTokens)} cache</span></span>
                  <span className="text-right text-xs"><strong className="block">{episode.execution.fileChanges} changes</strong><span className={`capitalize ${mutedTextClass}`}>{episode.status}</span></span>
                </summary>
                <div className="border-t border-[#dedbea] p-4 text-xs dark:border-[#373241]">
                  <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
                    <div><strong className="block">Preparation</strong><span className={mutedTextClass}>{episode.preparation.questions} questions · {episode.preparation.context} context · {episode.corrections} corrections{episode.preparation.patternReferences ? ` · ${episode.preparation.patternReferences} prior pattern refs` : ''}</span></div>
                    <div><strong className="block">Discovery</strong><span className={mutedTextClass}>{patternSignal}{episode.discovery.firstPatternLatencyMs === null ? '' : ` · ${(episode.discovery.firstPatternLatencyMs / 1_000).toFixed(1)}s`}</span></div>
                  </div>
                  <div className={`mt-3 ${mutedTextClass}`}>{Math.round(episode.classificationConfidence * 100)}% prompt classification confidence · {episode.execution.webSearches} searches · {episode.execution.delegations} delegations · {episode.execution.compactions} compactions</div>
                </div>
              </details>;
            })}{directiveEpisodes.length === 0 && <div className="rounded-xl border border-dashed border-[#c8c1df] p-5 text-sm dark:border-[#4d455e]">No prompts have produced an observable repository change in this session.</div>}</div>
          </>}
        </section>
        <div className="mt-6 grid grid-cols-[.8fr_1.2fr] gap-6 max-[850px]:grid-cols-1">
          <section className={`${panelClass} p-6`}><h3>Technical activity</h3><p className={`mt-1 text-xs ${mutedTextClass}`}>Diagnostic session totals; directive episodes will provide the evaluative breakdown.</p><div className="mt-4 grid grid-cols-2 gap-3">{[['File changes', snapshot.evidence.fileChange ?? 0], ['Web searches', snapshot.evidence.webSearch ?? 0], ['Delegations', snapshot.evidence.delegation ?? 0], ['Compactions', snapshot.evidence.contextCompaction ?? 0]].map(([label, value]) => <div className="rounded-xl border border-[#dedbea] p-4 dark:border-[#373241]" key={label}><strong className="block text-xl">{value}</strong><span className={`text-xs ${mutedTextClass}`}>{label}</span></div>)}</div></section>
          <section className={`${panelClass} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3>Model and reasoning usage</h3><p className={`mt-1 text-xs ${mutedTextClass}`}>Expand either total for its model and reasoning breakdown.</p></div>
              <div className="w-[180px]"><label className="sr-only" htmlFor="worker-range">Worker activity period</label><FloatingSelect id="worker-range" value={workerRange} options={[{ value: 'active', label: 'Running now' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }]} onChange={value => setWorkerRange(value as WorkerRange)} /></div>
            </div>
            <div className="mt-4 grid gap-3">{usageTotals.map(group => <div className="rounded-xl border border-[#dedbea] dark:border-[#373241]" key={group.scope}>
              <button aria-expanded={expandedUsage[group.scope]} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left" onClick={() => setExpandedUsage(current => ({ ...current, [group.scope]: !current[group.scope] }))} type="button">
                <span aria-hidden="true" className={`text-sm transition-transform ${expandedUsage[group.scope] ? 'rotate-90' : ''}`}>▶</span>
                <span><span className="flex flex-wrap items-center gap-2"><strong>{group.scope}</strong>{group.running > 0 && <span className="rounded-full bg-[#e8f6eb] px-2 py-0.5 text-[10px] font-semibold text-[#236534] dark:bg-[#203a28] dark:text-[#9ce0ad]">{group.running} running</span>}</span><span className={`mt-1 block text-xs ${mutedTextClass}`}>{group.workers} worker{group.workers === 1 ? '' : 's'} · {number.format(group.inputTokens)} input</span><span className={`mt-1 block text-xs ${mutedTextClass}`}>{number.format(group.cachedInputTokens)} cached · {number.format(Math.max(0, group.inputTokens - group.cachedInputTokens))} uncached · {cacheHitRate(group.inputTokens, group.cachedInputTokens)} hit</span></span>
                <span className="text-right"><strong>{number.format(group.totalTokens)}</strong><span className={`mt-1 block text-xs ${mutedTextClass}`}>{number.format(group.outputTokens)} output</span></span>
              </button>
              {expandedUsage[group.scope] && <div className="border-t border-[#dedbea] p-3 dark:border-[#373241]">
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${mutedTextClass}`}>Model and reasoning breakdown</p>
                <div className="grid gap-2">{group.details.map(detail => <div className="grid grid-cols-[1fr_auto] gap-4 rounded-lg bg-[#f4f1fc] p-3 dark:bg-[#27222f]" key={detail.key}><span className="text-sm"><strong>{detail.model}</strong><span className={`mt-1 block text-xs ${mutedTextClass}`}>{detail.reasoning} reasoning · {detail.workers} worker{detail.workers === 1 ? '' : 's'} · {number.format(detail.inputTokens)} input</span><span className={`mt-1 block text-xs ${mutedTextClass}`}>{number.format(detail.cachedInputTokens)} cached · {number.format(Math.max(0, detail.inputTokens - detail.cachedInputTokens))} uncached · {cacheHitRate(detail.inputTokens, detail.cachedInputTokens)} hit</span></span><span className="text-right text-sm"><strong>{number.format(detail.totalTokens)}</strong><span className={`mt-1 block text-xs ${mutedTextClass}`}>{number.format(detail.outputTokens)} output</span></span></div>)}</div>
              </div>}
            </div>)}{!usageTotals.length && <div className="rounded-xl border border-dashed border-[#c8c1df] p-5 text-sm dark:border-[#4d455e]"><strong>No usage in this period</strong><p className={`mt-2 ${mutedTextClass}`}>Choose a wider range to see historical usage.</p></div>}</div>
          </section>
        </div>
      </>}
    </section>
  );
}
