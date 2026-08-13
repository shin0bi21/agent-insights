#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import process from 'node:process';
import { chooseRepositoryDirectory, createRunManager, discoverSkills, providerCatalog, validateRepository } from './benchmark-web-lib.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC_ROOT = resolve(ROOT, 'frontend/dist');
const manager = createRunManager({ root: ROOT });
const port = Number(process.env.BENCHMARK_WEB_PORT ?? 4173);

const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let source = '';
  for await (const chunk of request) {
    source += chunk;
    if (source.length > 100_000) throw new Error('Request is too large.');
  }
  return source ? JSON.parse(source) : {};
}

function staticFile(pathname, response) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const path = resolve(PUBLIC_ROOT, relative);
  if (!path.startsWith(`${PUBLIC_ROOT}${sep}`) || !existsSync(path) || !statSync(path).isFile()) return false;
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
  return true;
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, 'http://127.0.0.1');
  try {
    if (request.method === 'GET' && url.pathname === '/api/runs') return json(response, 200, manager.list());
    if (request.method === 'GET' && url.pathname === '/api/providers') return json(response, 200, providerCatalog());
    if (request.method === 'GET' && url.pathname.startsWith('/api/runs/')) {
      const run = manager.get(url.pathname.split('/').at(-1));
      return run ? json(response, 200, run) : json(response, 404, { error: 'Run not found.' });
    }
    if (request.method === 'POST' && url.pathname === '/api/repository') {
      const input = await body(request);
      const repo = validateRepository(input.repo);
      return json(response, 200, { repo, skills: discoverSkills(repo) });
    }
    if (request.method === 'POST' && url.pathname === '/api/pick-directory') return json(response, 200, { repo: chooseRepositoryDirectory() });
    if (request.method === 'POST' && url.pathname === '/api/runs') return json(response, 202, manager.start(await body(request)));
    if (request.method === 'GET' && staticFile(url.pathname, response)) return;
    json(response, 404, { error: 'Not found.' });
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(handleRequest).listen(port, '127.0.0.1', () => {
    console.log(`Repo Automation Score: http://127.0.0.1:${port}`);
  });
}
