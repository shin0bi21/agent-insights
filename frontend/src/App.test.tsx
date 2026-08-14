import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App, { formatDuration, summarizeBenchmarkProgress } from './App';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
  const path = String(input);
  const value = path.endsWith('/api/providers')
    ? [{ id: 'codex', label: 'Codex', models: [{ id: 'luna', label: 'Luna' }] }]
    : path.endsWith('/api/repository')
      ? { repo: '/tmp/example', skills: Array.from({ length: 5 }, (_, index) => ({ name: `skill-${index}`, description: '', path: '' })) }
      : [];
  return { ok: true, json: async () => value } as Response;
}));

test('renders the typed run configuration and provider catalog', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Repo Automation Score' })).toBeInTheDocument();
  expect(screen.getByLabelText('Local repository path')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Platform' })).toHaveTextContent('Codex'));
  expect(screen.getByRole('button', { name: 'Model' })).toHaveTextContent('Luna');
  expect(screen.getByRole('button', { name: 'What kind of feature is this?' })).toHaveTextContent('Full stack');
  expect(screen.queryByText('Repository skill')).not.toBeInTheDocument();
});

test('shows repository readiness inside the repository section', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Local repository path'), { target: { value: '/tmp/example' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  const repository = screen.getByRole('group', { name: 'Repository' });
  expect(await within(repository).findByText('Repository ready. AGENTS.md and 5 skills discovered.')).toBeInTheDocument();
  expect(repository).toHaveClass('ready');
});

test('marks the repository step as invalid when agent guidance is missing', async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    const path = String(input);
    if (path.endsWith('/api/providers') || path.endsWith('/api/runs')) return { ok: true, json: async () => [] } as Response;
    return { ok: false, json: async () => ({ error: 'Repository is not automation-ready: AGENTS.md is required.' }) } as Response;
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText('Local repository path'), { target: { value: '/tmp/unguided' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  const repository = screen.getByRole('group', { name: 'Repository' });
  expect(await within(repository).findByText(/AGENTS\.md is required/)).toBeInTheDocument();
  expect(repository).toHaveClass('error');
});

test('formats elapsed run time compactly', () => {
  expect(formatDuration(3_725_000)).toBe('1h 2m 5s');
  expect(formatDuration(45_000)).toBe('45s');
});

test('summarizes benchmark activity without Codex state noise', () => {
  const progress = `Runner\n[benchmark] gpt-5.6-sol (low) repetition 1/1\nPreparing worktree (detached HEAD 70221361)\nAgent progress\n2026-08-14T03:41:06Z WARN codex_rollout::list: state db discrepancy during lookup: falling_back\n2026-08-14T03:45:03Z ERROR codex_core::tools::router: error=apply_patch verification failed in /tmp/my-webapp-agent-benchmark-ABC/gpt-5.6-sol-low-run-1/file.ts`;
  expect(summarizeBenchmarkProgress(progress)).toEqual({
    worktree: '/tmp/my-webapp-agent-benchmark-ABC/gpt-5.6-sol-low-run-1',
    summary: '[benchmark] gpt-5.6-sol (low) repetition 1/1\nPreparing worktree (detached HEAD 70221361)\nAgent adjusted a patch after the target changed.',
  });
});

test('persists the selected appearance from Settings', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('radio', { name: /Dark/ }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('repo-score-theme')).toBe('dark');
});

test('separates the current run from run history', async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    const path = String(input);
    const value = path.endsWith('/api/providers')
      ? [{ id: 'codex', label: 'Codex', models: [{ id: 'luna', label: 'Luna' }] }]
      : path.endsWith('/api/runs')
        ? [
            { id: 'active', createdAt: new Date().toISOString(), status: 'running', provider: 'codex', model: 'luna', reasoningEffort: 'low', featureType: 'frontend', skill: 'develop-feature', description: 'Active feature', artifactPath: '/tmp/active', progress: '', comparison: null },
            { id: 'done', createdAt: new Date().toISOString(), status: 'completed', provider: 'codex', model: 'luna', reasoningEffort: 'low', featureType: 'full-stack', skill: 'develop-feature', description: 'Finished feature', artifactPath: '/tmp/done', progress: '', comparison: null },
            { id: 'stale', createdAt: new Date().toISOString(), status: 'interrupted', provider: 'codex', model: 'terra', reasoningEffort: 'low', featureType: 'backend', skill: 'develop-feature', description: 'Interrupted feature', artifactPath: '/tmp/stale', progress: '', comparison: null },
          ]
        : [];
    return { ok: true, json: async () => value } as Response;
  });

  render(<App />);
  expect(await screen.findByText('Frontend request')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run in progress' })).toBeDisabled();
  expect(screen.queryByText('Agent run started.')).not.toBeInTheDocument();
  expect(screen.queryByText('interrupted')).not.toBeInTheDocument();
  expect(screen.queryByText('Active feature')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Request' }));
  expect(screen.getByRole('dialog', { name: 'Feature request' })).toHaveTextContent('Active feature');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByText('Finished feature')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByRole('heading', { name: 'Run history' })).toBeInTheDocument();
  expect(screen.getByText('Full-stack request')).toBeInTheDocument();
  expect(screen.getByText('Backend request')).toBeInTheDocument();
  expect(screen.getByText('interrupted')).toBeInTheDocument();
  expect(screen.queryByText('Finished feature')).not.toBeInTheDocument();
  expect(screen.queryByText('Active feature')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page');
});
