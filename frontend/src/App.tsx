import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api } from './api';
import type { AgentProvider, RunRecord, StartRunInput } from './types';
import FloatingSelect from './common/components/FloatingSelect/FloatingSelect';
import RunRequestMenu from './common/components/RunRequestMenu/RunRequestMenu';
import RunActivityTree from './common/components/RunActivityTree/RunActivityTree';
import RunJobMenu from './common/components/RunJobMenu/RunJobMenu';
import RunReportMenu from './common/components/RunReportMenu/RunReportMenu';
import './styles.css';

const emptyRun: StartRunInput = { repo: '', provider: '', model: '', reasoningEffort: 'low', featureType: 'full-stack', description: '' };
type Theme = 'light' | 'dark';
type RepositoryTone = 'idle' | 'checking' | 'ready' | 'error';

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours ? `${hours}h` : '', minutes || hours ? `${minutes}m` : '', `${remainder}s`].filter(Boolean).join(' ');
}

export function summarizeBenchmarkProgress(progress: string) {
  const worktree = progress.match(/\/[^\n:]*?-agent-benchmark-[^/\s:]+\/[^/\s:]+-run-\d+/)?.[0] ?? null;
  const lines: string[] = [];
  for (const rawLine of progress.split('\n')) {
    const line = rawLine.trim();
    if (!line || line === 'Runner' || line === 'Agent progress' || line.includes('state db discrepancy')) continue;
    if (line.includes('apply_patch verification failed')) {
      if (!lines.includes('Agent adjusted a patch after the target changed.')) lines.push('Agent adjusted a patch after the target changed.');
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) continue;
    lines.push(line);
  }
  return { worktree, summary: lines.join('\n') || 'Agent is working in the isolated benchmark worktree.' };
}

function RunCard({ run, now }: { run: RunRecord; now: number }) {
  const result = run.comparison?.comparison[0];
  const duration = run.status === 'running' ? now - new Date(run.createdAt).getTime() : null;
  const requestType = run.featureType === 'frontend' ? 'Frontend request' : run.featureType === 'backend' ? 'Backend request' : 'Full-stack request';
  const activity = summarizeBenchmarkProgress(run.progress ?? '');
  return <article className="run">
    <div className="run-top"><div className="run-summary"><span className="run-label">Request type</span><strong className="run-request-type">{requestType}</strong><div className="run-actions"><RunRequestMenu description={run.description}/><RunJobMenu run={run} worktree={activity.worktree}/>{result && <RunReportMenu result={result}/>}</div></div><div className="run-state"><span className={`badge ${run.status}`}>{run.status}</span>{duration !== null && <small>{formatDuration(duration)}</small>}</div></div>
    {run.status === 'running' && (run.activity?.length ? <div className="live-activity"><div className="live-activity-heading"><strong>Live activity</strong><span>Updating</span></div><RunActivityTree nodes={run.activity}/></div> : run.progress && <div className="live-activity"><div className="live-activity-heading"><strong>Live activity</strong></div><p className="activity-fallback">{activity.summary}</p></div>)}
    {run.status === 'running' && run.progress && <details className="progress"><summary>Raw diagnostic log</summary><pre className="log">{run.progress}</pre></details>}
  </article>;
}

export default function App() {
  const [view, setView] = useState<'home' | 'history' | 'settings'>('home');
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('repo-score-theme') === 'dark' ? 'dark' : 'light');
  const [input, setInput] = useState(emptyRun);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [message, setMessage] = useState('');
  const [repositoryMessage, setRepositoryMessage] = useState('');
  const [repositoryTone, setRepositoryTone] = useState<RepositoryTone>('idle');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [setupHeight, setSetupHeight] = useState<number | null>(null);
  const setupRef = useRef<HTMLElement>(null);
  const provider = useMemo(() => providers.find(item => item.id === input.provider), [providers, input.provider]);
  const currentRun = runs[0];
  const historyRuns = runs.slice(1);
  const runInProgress = currentRun?.status === 'running';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('repo-score-theme', theme);
  }, [theme]);

  const loadRuns = useCallback(async () => {
    try { setRuns(await api.runs()); } catch (error) { setMessage((error as Error).message); }
  }, []);

  useEffect(() => {
    void Promise.all([api.providers(), api.runs()]).then(([catalog, history]) => {
      const firstProvider = catalog[0];
      setProviders(catalog); setRuns(history);
      setInput(current => ({ ...current, provider: firstProvider?.id ?? '', model: firstProvider?.models[0]?.id ?? '' }));
    }).catch(error => setMessage((error as Error).message));
  }, []);

  useEffect(() => {
    if (!runs.some(run => run.status === 'running')) return;
    const timer = window.setTimeout(() => void loadRuns(), 3000);
    return () => window.clearTimeout(timer);
  }, [runs, loadRuns]);

  useEffect(() => {
    if (!runs.some(run => run.status === 'running')) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [runs]);

  useEffect(() => {
    const setup = setupRef.current;
    if (!setup) return;
    const update = () => setSetupHeight(setup.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }
    const observer = new ResizeObserver(update);
    observer.observe(setup);
    return () => observer.disconnect();
  }, []);

  async function connect(repo = input.repo) {
    setRepositoryMessage('Connecting…');
    setRepositoryTone('checking');
    try {
      const result = await api.connectRepository(repo);
      setInput(current => ({ ...current, repo: result.repo }));
      setRepositoryMessage(`Repository ready. AGENTS.md and ${result.skills.length} skill${result.skills.length === 1 ? '' : 's'} discovered.`);
      setRepositoryTone('ready');
    } catch (error) { setRepositoryMessage((error as Error).message); setRepositoryTone('error'); }
  }

  async function browse() {
    setBusy(true); setRepositoryMessage('Opening folder picker…'); setRepositoryTone('checking');
    try { const result = await api.pickDirectory(); await connect(result.repo); }
    catch (error) { setRepositoryMessage((error as Error).message); setRepositoryTone('error'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const run = await api.startRun(input);
      setRuns(current => [run, ...current.filter(item => item.id !== run.id)]);
    }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className="site-header"><nav className="site-nav" aria-label="Primary navigation"><button aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')} type="button">Home</button><button aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')} type="button">History</button><button aria-current={view === 'settings' ? 'page' : undefined} onClick={() => setView('settings')} type="button">Settings</button></nav></header>
    <main id="main">
      {view === 'home' ? <><section className="hero" aria-labelledby="hero-title"><div><h1 className="product-name">Repo Automation Score</h1><h2 id="hero-title">Is your repo ready for automated workflows?</h2><p>Connect a guided Git repository, choose the feature scope, and gather real execution evidence from your chosen agent platform.</p></div></section>
      <div className="layout" style={setupHeight ? { '--setup-height': `${setupHeight}px` } as CSSProperties : undefined}>
        <section ref={setupRef} className="configure-panel" aria-label="Configure agent run">
          <form onSubmit={submit}>
            <fieldset className={`repository-step ${repositoryTone}`}><legend><span aria-hidden="true">1</span>Repository</legend><div className="step-content">{repositoryMessage && <p className="repository-status" role="status" aria-live="polite">{repositoryMessage}</p>}<label className="sr-only" htmlFor="repo">Local repository path</label><div className="input-action"><input id="repo" value={input.repo} onChange={event => { setInput({ ...input, repo: event.target.value }); setRepositoryMessage(''); setRepositoryTone('idle'); }} required placeholder="Local repository path"/><button type="button" disabled={busy} onClick={() => void browse()}>Browse…</button><button type="button" disabled={busy} onClick={() => void connect()}>Connect</button></div></div></fieldset>
            <fieldset><legend><span aria-hidden="true">2</span>Feature type</legend><div className="step-content"><label className="sr-only" htmlFor="feature-type">What kind of feature is this?</label><FloatingSelect id="feature-type" value={input.featureType} options={[{ value: 'full-stack', label: 'Full stack' }, { value: 'frontend', label: 'Frontend' }, { value: 'backend', label: 'Backend' }]} onChange={value => setInput({ ...input, featureType: value as StartRunInput['featureType'] })}/><p className="help">AGENTS.md chooses the repository workflow.</p></div></fieldset>
            <fieldset><legend><span aria-hidden="true">3</span>Agent</legend><div className="step-content three-columns"><div className="field"><label htmlFor="provider">Platform</label><FloatingSelect id="provider" value={input.provider} options={providers.map(item => ({ value: item.id, label: item.label }))} onChange={value => { const next = providers.find(item => item.id === value); setInput({ ...input, provider: value, model: next?.models[0]?.id ?? '' }); }}/></div><div className="field"><label htmlFor="model">Model</label><FloatingSelect id="model" value={input.model} options={provider?.models.map(item => ({ value: item.id, label: item.label })) ?? []} onChange={value => setInput({ ...input, model: value })}/></div><div className="field"><label htmlFor="reasoning">Reasoning</label><FloatingSelect id="reasoning" value={input.reasoningEffort} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} onChange={value => setInput({ ...input, reasoningEffort: value })}/></div></div></fieldset>
            <fieldset><legend><span aria-hidden="true">4</span>Feature request</legend><div className="step-content"><label className="sr-only" htmlFor="description">What should the agent build?</label><textarea id="description" value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} required rows={3} placeholder="What should the agent build?"/></div></fieldset>
            <div className="form-status" role="status" aria-live="polite">{message}</div><button className="primary" disabled={busy || runInProgress} type="submit">{busy ? <><span className="spinner" aria-hidden="true"/>Starting run…</> : runInProgress ? <><span className="spinner" aria-hidden="true"/>Run in progress</> : <>Start agent run <span aria-hidden="true">→</span></>}</button>
          </form>
        </section>
        <section className="panel runs-panel" aria-labelledby="current-run-title"><div className="panel-heading"><div><span>LATEST</span><h2 id="current-run-title">Current run</h2></div><button className="quiet" onClick={() => void loadRuns()} type="button">Refresh</button></div><div className="runs" aria-live="polite">{currentRun ? <RunCard run={currentRun} now={now}/> : <p className="empty">No runs yet.</p>}</div></section>
      </div></> : view === 'history' ? <section className="history-view" aria-labelledby="history-title"><div className="page-heading"><div><p className="kicker">RUN ARCHIVE</p><h2 id="history-title">Run history</h2><p>Review every run before the latest one, including interrupted attempts.</p></div><button className="quiet" onClick={() => void loadRuns()} type="button">Refresh history</button></div><section className="panel"><div className="runs history-runs" aria-live="polite">{historyRuns.length ? historyRuns.map(run => <RunCard key={run.id} run={run} now={now}/>) : <p className="empty">No earlier runs yet.</p>}</div></section></section> : <section className="settings-view" aria-labelledby="settings-title"><div className="page-heading"><div><p className="kicker">PREFERENCES</p><h2 id="settings-title">Settings</h2><p>Choose how Repo Automation Score looks on this machine.</p></div></div><section className="panel settings-panel"><h3>Appearance</h3><div className="theme-options" role="radiogroup" aria-label="Color theme">{(['light', 'dark'] as Theme[]).map(option => <button key={option} className="theme-option" role="radio" aria-checked={theme === option} onClick={() => setTheme(option)} type="button"><span className={`theme-preview ${option}`} aria-hidden="true"><i/><i/><i/></span><strong>{option === 'light' ? 'Light' : 'Dark'}</strong><small>{option === 'light' ? 'White with purple accents' : 'Deep charcoal with purple accents'}</small></button>)}</div></section></section>}
    </main>
  </>;
}
