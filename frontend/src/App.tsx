import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { AgentProvider, RepositorySkill, RunRecord, StartRunInput } from './types';
import './styles.css';

const emptyRun: StartRunInput = { repo: '', provider: '', model: '', reasoningEffort: 'low', skill: '', description: '' };

function RunCard({ run }: { run: RunRecord }) {
  const result = run.comparison?.comparison[0];
  const misses = result ? Object.keys(result.missedRequirements) : [];
  return <article className="run">
    <div className="run-top"><div><h3>{run.description}</h3><div className="meta">{run.provider ?? 'codex'} / {run.model.replace('gpt-5.6-', '')} · {run.reasoningEffort} · {run.skill || 'no skill'}</div></div><span className={`badge ${run.status}`}>{run.status}</span></div>
    {result && <><p className="score">{result.medianScore ?? '—'}%</p><p className="misses">{misses.length ? `Missed: ${misses.join(', ')}` : 'All structural contracts found.'}</p></>}
    {run.status === 'running' && run.progress && <pre className="log">{run.progress}</pre>}
  </article>;
}

export default function App() {
  const [input, setInput] = useState(emptyRun);
  const [providers, setProviders] = useState<AgentProvider[]>([]);
  const [skills, setSkills] = useState<RepositorySkill[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const provider = useMemo(() => providers.find(item => item.id === input.provider), [providers, input.provider]);
  const skill = skills.find(item => item.name === input.skill);

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
    <header className="site-header"><div><span className="eyebrow">AUTOMATION READINESS</span><h1>Repo Automation Score</h1></div><span className="local-status"><i /> Runs locally</span></header>
    <main id="main">
      <section className="hero" aria-labelledby="hero-title"><div><p className="kicker">UNDERSTAND · CHANGE · VERIFY</p><h2 id="hero-title">Measure how ready your repo is for coding agents.</h2><p>Connect a Git repository, select its workflow skill, and gather real execution evidence from your chosen agent platform.</p></div><div className="hero-stat"><strong>Local-first</strong><span>Source code and artifacts stay on this machine.</span></div></section>
      <div className="layout">
        <section className="panel" aria-labelledby="configure-title"><div className="panel-heading"><div><span>NEW RUN</span><h2 id="configure-title">Configure agent run</h2></div><span className="step">01</span></div>
          <form onSubmit={submit}>
            <fieldset><legend>Repository</legend><label htmlFor="repo">Local repository path</label><div className="input-action"><input id="repo" value={input.repo} onChange={event => setInput({ ...input, repo: event.target.value })} required placeholder="/Users/you/projects/my-app"/><button type="button" disabled={busy} onClick={() => void browse()}>Browse…</button><button type="button" disabled={busy} onClick={() => void connect()}>Connect</button></div><p className="help">Choose a folder or enter the absolute path to a Git repository.</p></fieldset>
            <fieldset disabled={!skills.length}><legend>Workflow</legend><label htmlFor="skill">Repository skill</label><select id="skill" value={input.skill} onChange={event => setInput({ ...input, skill: event.target.value })}><option value="">No skill selected</option>{skills.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select><p className="help">{skill?.description || 'Connect a repository to discover skills.'}</p></fieldset>
            <fieldset><legend>Agent</legend><div className="three-columns"><label>Platform<select value={input.provider} onChange={event => { const next = providers.find(item => item.id === event.target.value); setInput({ ...input, provider: event.target.value, model: next?.models[0]?.id ?? '' }); }}>{providers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Model<select value={input.model} onChange={event => setInput({ ...input, model: event.target.value })}>{provider?.models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Reasoning<select value={input.reasoningEffort} onChange={event => setInput({ ...input, reasoningEffort: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div></fieldset>
            <fieldset><legend>Feature request</legend><label htmlFor="description">What should the agent build?</label><textarea id="description" value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} required rows={4} placeholder="Develop a new feature using this repository's conventions."/></fieldset>
            <div className="form-status" role="status" aria-live="polite">{message}</div><button className="primary" disabled={busy} type="submit">Start agent run <span aria-hidden="true">→</span></button>
          </form>
        </section>
        <section className="panel runs-panel" aria-labelledby="runs-title"><div className="panel-heading"><div><span>HISTORY</span><h2 id="runs-title">Recent runs</h2></div><button className="quiet" onClick={() => void loadRuns()} type="button">Refresh</button></div><div className="runs" aria-live="polite">{runs.length ? runs.map(run => <RunCard key={run.id} run={run}/>) : <p className="empty">No web runs yet.</p>}</div></section>
      </div>
    </main>
  </>;
}
