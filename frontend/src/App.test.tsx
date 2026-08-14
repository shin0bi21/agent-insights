import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App, { formatDuration } from './App';

afterEach(cleanup);

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
  const path = String(input);
  const value = path.endsWith('/api/providers') ? [{ id: 'codex', label: 'Codex', models: [{ id: 'luna', label: 'Luna' }] }] : [];
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

test('formats elapsed run time compactly', () => {
  expect(formatDuration(3_725_000)).toBe('1h 2m 5s');
  expect(formatDuration(45_000)).toBe('45s');
});

test('separates the current run from run history', async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    const path = String(input);
    const value = path.endsWith('/api/providers')
      ? [{ id: 'codex', label: 'Codex', models: [{ id: 'luna', label: 'Luna' }] }]
      : path.endsWith('/api/runs')
        ? [
            { id: 'active', createdAt: new Date().toISOString(), status: 'running', provider: 'codex', model: 'luna', reasoningEffort: 'low', skill: 'develop-feature', description: 'Active feature', artifactPath: '/tmp/active', progress: '', comparison: null },
            { id: 'done', createdAt: new Date().toISOString(), status: 'completed', provider: 'codex', model: 'luna', reasoningEffort: 'low', skill: 'develop-feature', description: 'Finished feature', artifactPath: '/tmp/done', progress: '', comparison: null },
          ]
        : [];
    return { ok: true, json: async () => value } as Response;
  });

  render(<App />);
  expect(await screen.findByText('Active feature')).toBeInTheDocument();
  expect(screen.queryByText('Finished feature')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.getByRole('heading', { name: 'Run history' })).toBeInTheDocument();
  expect(screen.getByText('Finished feature')).toBeInTheDocument();
  expect(screen.queryByText('Active feature')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page');
});
