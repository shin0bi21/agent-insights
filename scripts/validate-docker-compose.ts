import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const environment = {
  ...process.env,
  RAS_REPOSITORY_PATH: '/tmp/repo-automation-score-ci-repository',
  RAS_RUNTIME_PATH: '/tmp/repo-automation-score-ci-runtime',
};

for (const files of [
  ['docker-compose.yml'],
  ['docker-compose.yml', 'docker-compose.runner.yml'],
]) {
  const args = ['compose', ...files.flatMap(file => ['-f', file]), 'config', '--quiet'];
  const result = spawnSync('docker', args, { cwd: root, env: environment, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Docker Compose validation failed for ${files.join(', ')}.\n`);
    process.exit(result.status ?? 1);
  }
}

process.stdout.write('Docker Compose configurations are valid.\n');
