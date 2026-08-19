import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Live from './Live';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('watches normalized Codex usage without starting a turn', async () => {
  const requests: string[] = [];
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const path = String(input); requests.push(path);
    if (path.endsWith('/api/sessions/import')) return new Response(JSON.stringify({
      id: 'review-1', title: 'Codex session thread-1', status: 'idle', telemetryLevel: 'imported',
      observedSequence: 3, durableSequence: 3, startedAt: '2026-08-19T00:00:00.000Z', completedAt: null,
      turnCount: 2, eventCount: 3, checkCount: 0, changedFileEventCount: 0,
      inputTokens: 80, cachedInputTokens: 40, outputTokens: 20, platform: 'codex',
      externalSessionId: 'thread-1234', repositoryName: 'app', evidence: { toolCall: 3 }, usageAvailable: true,
      workerUsage: [{ id: 'worker-main', name: 'Main agent', role: 'orchestrator', model: 'gpt-sol', reasoningLevel: 'low', inputTokens: 80, cachedInputTokens: 40, cacheWriteInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 5, totalTokens: 100 }],
      modelUsage: [],
    }), { status: 201 });
    if (path.endsWith('/live')) return new Response(JSON.stringify({
      externalId: 'thread-1234', title: 'Build live mode', repositoryName: 'app', status: 'active',
      observedAt: '2026-08-19T00:00:00.000Z', contextWindow: 200, contextTokens: 50,
      contextPercent: 25, turnCount: 2, completedTurnCount: 1, evidence: { toolCall: 3 },
      guidance: { available: true, agentsReads: 2, skillReads: 1, skillsUsed: ['develop-feature'], promptCount: 2, promptsWithSkillRead: 1, averageSkillReadLatencyMs: 2400, currentPromptHasSkillRead: false },
      workers: [
        { externalThreadId: 'thread-1234', parentExternalThreadId: null, nickname: null, role: null, model: 'gpt-sol', reasoningLevel: 'low', inputTokens: 80, cachedInputTokens: 40, cacheWriteInputTokens: 0, outputTokens: 20, reasoningOutputTokens: 5, totalTokens: 100, active: true, updatedAt: new Date().toISOString() },
        { externalThreadId: 'thread-old', parentExternalThreadId: 'thread-1234', nickname: 'Historical worker', role: null, model: 'gpt-sol', reasoningLevel: 'medium', inputTokens: 40, cachedInputTokens: 20, cacheWriteInputTokens: 0, outputTokens: 5, reasoningOutputTokens: 1, totalTokens: 45, active: false, updatedAt: '2025-01-01T00:00:00.000Z' },
      ],
    }), { status: 200 });
    return new Response(JSON.stringify([
      { externalId: 'thread-1234', title: 'Build live mode', repositoryName: 'app', source: 'cli', status: 'active', createdAt: null, updatedAt: new Date().toISOString(), branch: null, revision: null },
      { externalId: 'thread-old', title: 'Old archived work', repositoryName: 'legacy-app', source: 'cli', status: 'idle', createdAt: null, updatedAt: '2025-01-01T00:00:00.000Z', branch: null, revision: null },
    ]), { status: 200 });
  });
  render(<Live />);
  expect(await screen.findByText('Build live mode')).toBeInTheDocument();
  expect(screen.queryByText('Old archived work')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Session activity period' }));
  fireEvent.click(screen.getByRole('option', { name: 'Last 24 hours' }));
  expect(screen.queryByText('Old archived work')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Generate static review' }));
  expect((await screen.findAllByText('Unavailable')).length).toBeGreaterThan(0);
  expect(screen.getByText(/static snapshot/)).toBeInTheDocument();
  expect(screen.getByText('Guidance telemetry is unavailable in this durable review.')).toBeInTheDocument();
  expect(await screen.findByText('Static review generated from durable SQLite evidence.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start watching' }));
  expect(await screen.findByText(/updating every second/)).toBeInTheDocument();
  expect(await screen.findByText('25.0%')).toBeInTheDocument();
  expect(screen.getByText('No skill path reference observed for latest prompt')).toBeInTheDocument();
  expect(screen.getByText('2.4s')).toBeInTheDocument();
  expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
  expect(screen.getByText(/40 cached · 40 uncached · 50.0% hit/)).toBeInTheDocument();
  expect(screen.queryByText(/low reasoning · 1 worker/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Main agent/ }));
  expect(screen.getByText(/low reasoning · 1 worker/)).toBeInTheDocument();
  expect(screen.queryByText('Historical worker')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Worker activity period' }));
  fireEvent.click(screen.getByRole('option', { name: 'All time' }));
  expect(screen.queryByText('Historical worker')).not.toBeInTheDocument();
  expect(screen.getByText('Subagents')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Subagents/ }));
  expect(screen.getByText(/medium reasoning · 1 worker/)).toBeInTheDocument();
  expect(screen.getAllByText(/20 cached · 20 uncached · 50.0% hit/).length).toBeGreaterThan(0);
  expect(screen.getByText('Historical worker')).toBeInTheDocument();
  expect(screen.getAllByText('Agent breakdown').length).toBeGreaterThan(0);
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' }));
  expect(requests.some(path => path.endsWith('/live'))).toBe(true);
  expect(requests.some(path => path.includes('turn/start'))).toBe(false);
});
