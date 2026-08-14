import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { AgentProvider, RepositorySkill, RunRecord, StartRunInput } from './types';
import FloatingSelect from './common/components/FloatingSelect/FloatingSelect';
import './styles.css';

const emptyRun: StartRunInput = { repo: '', provider: '', model: '', reasoningEffort: 'low', skill: '', description: '' };
const terminalRunStatuses = new Set(['completed', 'failed', 'cancelled', 'timed-out']);

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours ? `${hours}h` : '', minutes || hours ? `${minutes}m` : '', `${remainder}s`].filter(Boolean).join(' ');
}

function RunCard({ run, now }: { run: RunRecord; now: number }) {
  const result = run.comparison?.comparison[0];
  const misses = result ? Object.keys(result.missedRequirements) : [];
  const duration = result?.medianDurationMs ?? (run.status === 'running' ? now - new Date(run.createdAt).getTime() : null);
  return <article className="run">
    <div className="run-top"><div className="run-summary"><span className="run-label">Feature request</span><p className="run-prompt">{run.description}</p></div><span className={`badge ${run.status}`}>{run.status}</span></div>
    <dl className="run-details"><div><dt>Agent</dt><dd>{run.provider ?? 'codex'} / {run.model.replace('gpt-5.6-', '')}</dd></div><div><dt>Reasoning</dt><dd>{run.reasoningEffort}</dd></div><div><dt>Skill</dt><dd>{run.skill || 'None'}</dd></div>{duration !== null && <div><dt>{run.status === 'running' ? 'Elapsed' : 'Duration'}</dt><dd>{formatDuration(duration)}</dd></div>}<div className="artifact-detail"><dt>Local artifacts</dt><dd title={run.artifactPath}>{run.artifactPath}</dd></div></dl>
    {result && <><p className="score">{result.medianScore ?? '—'}%</p><p className="misses">{misses.length ? `Missed: ${misses.join(', ')}` : 'All structural contracts found.'}</p></>}
    {run.progress && <details className="progress"><summary>{run.status === 'running' ? 'Live progress' : 'Run log'}</summary><pre className="log">{run.progress}</pre></details>}
  </article>;
}

export default function App() {
  const [view, setView] = useState<'home' | 'history'>('home');
  const [input, setInput] = useState(emptyRun);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [skills, setSkills] = useState<RepositorySkill[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const provider = useMemo(() => providers.find(item => item.id === input.provider), [providers, input.provider]);
  const skill = skills.find(item => item.name === input.skill);
  const currentRuns = runs.filter(run => !terminalRunStatuses.has(run.status));
  const historyRuns = runs.filter(run => terminalRunStatuses.has(run.status));

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

  async function connect(repo = input.repo) {
    setMessage('Connecting…');
    try {
      const result = await api.connectRepository(repo);
      const preferred = result.skills.find(item => item.name === 'develop-feature');
      setSkills(result.skills);
      setInput(current => ({ ...current, repo: result.repo, skill: preferred?.name ?? '' }));
      setMessage(`${result.skills.length} repository skill${result.skills.length === 1 ? '' : 's'} discovered.`);
    } catch (error) { setSkills([]); setMessage((error as Error).message); }
  }

  async function browse() {
    setBusy(true); setMessage('Opening folder picker…');
    try { const result = await api.pickDirectory(); await connect(result.repo); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('Starting agent run…');
    try { await api.startRun(input); setMessage('Agent run started.'); await loadRuns(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <a className="skip-link" href="#main">Skip to main content</a>
    <header className="site-header"><nav className="site-nav" aria-label="Primary navigation"><button aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')} type="button">Home</button><button aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')} type="button">History</button></nav></header>
    <main id="main">
      {view === 'home' ? <><section className="hero" aria-labelledby="hero-title"><div><h1 className="product-name">Repo Automation Score</h1><h2 id="hero-title">Is your repo ready for automated workflows?</h2><p>Connect a Git repository, select its workflow skill, and gather real execution evidence from your chosen agent platform.</p></div><div className="hero-stat"><strong>Local-first</strong><span>Source code and artifacts stay on this machine.</span></div></section>
      <div className="layout">
        <section className="panel" aria-labelledby="configure-title"><div className="panel-heading"><div><span>NEW RUN</span><h2 id="configure-title">Configure agent run</h2></div><span className="step">01</span></div>
          <form onSubmit={submit}>
            <fieldset><legend>Repository</legend><label htmlFor="repo">Local repository path</label><div className="input-action"><input id="repo" value={input.repo} onChange={event => setInput({ ...input, repo: event.target.value })} required placeholder="/Users/you/projects/my-app"/><button type="button" disabled={busy} onClick={() => void browse()}>Browse…</button><button type="button" disabled={busy} onClick={() => void connect()}>Connect</button></div><p className="help">Choose a folder or enter the absolute path to a Git repository.</p></fieldset>
            <fieldset disabled={!skills.length}><legend>Workflow</legend><label htmlFor="skill">Repository skill</label><FloatingSelect id="skill" value={input.skill} options={[{ value: '', label: 'No skill selected' }, ...skills.map(item => ({ value: item.name, label: item.name }))]} onChange={value => setInput({ ...input, skill: value })}/><p className="help">{skill?.description || 'Connect a repository to discover skills.'}</p></fieldset>
            <fieldset><legend>Agent</legend><div className="three-columns"><div className="field"><label htmlFor="provider">Platform</label><FloatingSelect id="provider" value={input.provider} options={providers.map(item => ({ value: item.id, label: item.label }))} onChange={value => { const next = providers.find(item => item.id === value); setInput({ ...input, provider: value, model: next?.models[0]?.id ?? '' }); }}/></div><div className="field"><label htmlFor="model">Model</label><FloatingSelect id="model" value={input.model} options={provider?.models.map(item => ({ value: item.id, label: item.label })) ?? []} onChange={value => setInput({ ...input, model: value })}/></div><div className="field"><label htmlFor="reasoning">Reasoning</label><FloatingSelect id="reasoning" value={input.reasoningEffort} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} onChange={value => setInput({ ...input, reasoningEffort: value })}/></div></div></fieldset>
            <fieldset><legend>Feature request</legend><label htmlFor="description">What should the agent build?</label><textarea id="description" value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} required rows={4} placeholder="Develop a new feature using this repository's conventions."/></fieldset>
            <div className="form-status" role="status" aria-live="polite">{message}</div><button className="primary" disabled={busy} type="submit">Start agent run <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section className="panel runs-panel" aria-labelledby="current-run-title"><div className="panel-heading"><div><span>IN PROGRESS</span><h2 id="current-run-title">Current run</h2></div><button className="quiet" onClick={() => void loadRuns()} type="button">Refresh</button></div><div className="runs" aria-live="polite">{currentRuns.length ? currentRuns.map(run => <RunCard key={run.id} run={run} now={now}/>) : <p className="empty">No agent run is currently active.</p>}</div></section>
      </div></> : <section className="history-view" aria-labelledby="history-title"><div className="page-heading"><div><p className="kicker">RUN ARCHIVE</p><h2 id="history-title">Run history</h2><p>Review completed and failed runs stored locally on this machine.</p></div><button className="quiet" onClick={() => void loadRuns()} type="button">Refresh history</button></div><section className="panel"><div className="runs history-runs" aria-live="polite">{historyRuns.length ? historyRuns.map(run => <RunCard key={run.id} run={run} now={now}/>) : <p className="empty">No completed runs yet.</p>}</div></section></section>}
    </main>
  </>;
}
