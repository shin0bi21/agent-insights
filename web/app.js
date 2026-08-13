const form = document.querySelector('#run-form');
const repoInput = document.querySelector('#repo');
const connectButton = document.querySelector('#connect');
const browseButton = document.querySelector('#browse');
const workflow = document.querySelector('#workflow');
const skillSelect = document.querySelector('#skill');
const skillDescription = document.querySelector('#skill-description');
const status = document.querySelector('#form-status');
const runsElement = document.querySelector('#runs');
const providerSelect = document.querySelector('#provider');
const modelSelect = document.querySelector('#model');
let skills = [];
let providers = [];

async function api(path, options) {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function connect() {
  status.textContent = 'Connecting…';
  try {
    const result = await api('/api/repository', { method: 'POST', body: JSON.stringify({ repo: repoInput.value }) });
    repoInput.value = result.repo;
    skills = result.skills;
    skillSelect.replaceChildren(new Option('No skill selected', ''), ...skills.map(skill => new Option(skill.name, skill.name)));
    const preferred = skills.find(skill => skill.name === 'develop-feature');
    if (preferred) skillSelect.value = preferred.name;
    workflow.disabled = false;
    updateSkill();
    status.textContent = `${skills.length} repository skill${skills.length === 1 ? '' : 's'} discovered.`;
  } catch (error) { status.textContent = error.message; workflow.disabled = true; }
}

async function browse() {
  status.textContent = 'Opening folder picker…';
  browseButton.disabled = true;
  try {
    const result = await api('/api/pick-directory', { method: 'POST', body: '{}' });
    repoInput.value = result.repo;
    await connect();
  } catch (error) { status.textContent = error.message; }
  finally { browseButton.disabled = false; }
}

function updateSkill() {
  const skill = skills.find(item => item.name === skillSelect.value);
  skillDescription.textContent = skill?.description || 'The agent will use the repository’s general instructions.';
}

function updateModels() {
  const provider = providers.find(item => item.id === providerSelect.value);
  modelSelect.replaceChildren(...(provider?.models ?? []).map(model => new Option(model.label, model.id)));
}

function escape(value) {
  const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML;
}

function renderRun(run) {
  const result = run.comparison?.comparison?.[0];
  const misses = result ? Object.keys(result.missedRequirements) : [];
  return `<article class="run"><div class="run-top"><div><h3>${escape(run.description)}</h3><div class="meta">${escape(run.provider || 'codex')} / ${escape(run.model.replace('gpt-5.6-', ''))} · ${escape(run.reasoningEffort)} · ${escape(run.skill || 'no skill')}</div></div><span class="badge ${escape(run.status)}">${escape(run.status)}</span></div>${result ? `<p class="score">${result.medianScore ?? '—'}%</p><p class="misses">${misses.length ? `Missed: ${escape(misses.join(', '))}` : 'All structural contracts found.'}</p>` : ''}${run.status === 'running' && run.progress ? `<pre class="log">${escape(run.progress)}</pre>` : ''}</article>`;
}

async function loadRuns() {
  try {
    const runs = await api('/api/runs');
    runsElement.innerHTML = runs.length ? runs.map(renderRun).join('') : '<p class="empty">No web runs yet.</p>';
    if (runs.some(run => run.status === 'running')) setTimeout(loadRuns, 3000);
  } catch (error) { runsElement.innerHTML = `<p class="empty">${escape(error.message)}</p>`; }
}

connectButton.addEventListener('click', connect);
browseButton.addEventListener('click', browse);
skillSelect.addEventListener('change', updateSkill);
providerSelect.addEventListener('change', updateModels);
document.querySelector('#refresh').addEventListener('click', loadRuns);
form.addEventListener('submit', async event => {
  event.preventDefault(); status.textContent = 'Starting benchmark…';
  const button = form.querySelector('.primary'); button.disabled = true;
  try {
    const input = Object.fromEntries(new FormData(form));
    await api('/api/runs', { method: 'POST', body: JSON.stringify(input) });
    status.textContent = 'Benchmark started. You can leave this page open to follow progress.';
    await loadRuns();
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
Promise.all([api('/api/providers'), loadRuns()]).then(([catalog]) => {
  providers = catalog;
  providerSelect.replaceChildren(...providers.map(provider => new Option(provider.label, provider.id)));
  updateModels();
}).catch(error => { status.textContent = error.message; });
