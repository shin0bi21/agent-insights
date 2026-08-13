import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';

vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
  const path = String(input);
  const value = path.endsWith('/api/providers') ? [{ id: 'codex', label: 'Codex', models: [{ id: 'luna', label: 'Luna' }] }] : [];
  return { ok: true, json: async () => value } as Response;
}));

test('renders the typed run configuration and provider catalog', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Repo Automation Score' })).toBeInTheDocument();
  expect(screen.getByLabelText('Local repository path')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('option', { name: 'Codex' })).toBeInTheDocument());
  expect(screen.getByRole('option', { name: 'Luna' })).toBeInTheDocument();
});
