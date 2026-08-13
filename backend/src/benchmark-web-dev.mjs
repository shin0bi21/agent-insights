#!/usr/bin/env node

import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--watch', 'backend/src/benchmark-web-server.mjs'], { stdio: 'inherit' }),
  spawn('npm', ['exec', '--', 'vite'], { stdio: 'inherit' }),
];

function stop(signal = 'SIGTERM') {
  for (const child of children) child.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
for (const child of children) child.on('exit', code => {
  if (code && process.exitCode === undefined) process.exitCode = code;
});
