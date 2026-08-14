import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { chooseRepositoryDirectory, createRunManager, providerCatalog, validateAutomationGuidance } from '../benchmark-web-lib.js';

type RunManager = {
  get(id: string): unknown | null | Promise<unknown | null>;
  list(): unknown | Promise<unknown>;
  start(input: Record<string, unknown>): unknown | Promise<unknown>;
};

export type CreateBenchmarkAppOptions = {
  root: string;
  manager?: RunManager;
  publicRoot?: string;
  chooseDirectory?: typeof chooseRepositoryDirectory;
  providers?: typeof providerCatalog;
  validateGuidance?: typeof validateAutomationGuidance;
  directoryPickerAvailable?: boolean;
  repositoryPath?: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Creates the local HTTP boundary without binding a port. Keeping construction
 * separate from the server entry point gives API tests an injectable run manager
 * and keeps privileged repository operations on the localhost service.
 */
export function createBenchmarkApp(options: CreateBenchmarkAppOptions): Express {
  const { root } = options;
  const manager = options.manager ?? createRunManager({ root });
  const publicRoot = options.publicRoot ?? resolve(root, 'frontend/dist');
  const pickDirectory = options.chooseDirectory ?? chooseRepositoryDirectory;
  const getProviders = options.providers ?? providerCatalog;
  const validateGuidance = options.validateGuidance ?? validateAutomationGuidance;
  const directoryPickerAvailable = options.directoryPickerAvailable ?? process.platform === 'darwin';
  const repositoryPath = options.repositoryPath ?? process.env.RAS_REPOSITORY_PATH ?? null;
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => {
    response.set('cache-control', 'no-store').json({ status: 'ok' });
  });

  app.get('/api/runs', async (_request, response) => {
    response.set('cache-control', 'no-store').json(await manager.list());
  });

  app.get('/api/providers', (_request, response) => {
    response.set('cache-control', 'no-store').json(getProviders());
  });

  app.get('/api/runtime', (_request, response) => {
    response.set('cache-control', 'no-store').json({ directoryPickerAvailable, repositoryPath });
  });

  app.get('/api/runs/:id', async (request, response) => {
    const run = await manager.get(request.params.id);
    if (!run) return response.status(404).set('cache-control', 'no-store').json({ error: 'Run not found.' });
    return response.set('cache-control', 'no-store').json(run);
  });

  app.post('/api/repository', (request, response) => {
    response.set('cache-control', 'no-store').json(validateGuidance(request.body?.repo));
  });

  app.post('/api/pick-directory', (_request, response) => {
    response.set('cache-control', 'no-store').json({ repo: pickDirectory() });
  });

  app.post('/api/runs', async (request, response) => {
    response.status(202).set('cache-control', 'no-store').json(await manager.start(request.body ?? {}));
  });

  if (existsSync(publicRoot)) app.use(express.static(publicRoot));

  app.use('/api', (_request, response) => {
    response.status(404).set('cache-control', 'no-store').json({ error: 'Not found.' });
  });

  app.use((_request, response) => {
    response.status(404).set('cache-control', 'no-store').json({ error: 'Not found.' });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = typeof error === 'object' && error !== null && 'status' in error && Number.isInteger(error.status)
      ? error.status as number
      : 400;
    response.status(status >= 400 && status < 500 ? status : 400)
      .set('cache-control', 'no-store')
      .json({ error: errorMessage(error) });
  });

  return app;
}
