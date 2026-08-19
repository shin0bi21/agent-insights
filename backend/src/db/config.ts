import { existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

/**
 * The database remains local and ignored by Git. An explicit path is useful for
 * tests and future desktop packaging without persisting a machine-specific path
 * in run records.
 */
export function databasePath(root = process.cwd()) {
  const configured = process.env.AGENT_AUTOMATION_SCORE_DB_PATH
    ?? process.env.REPO_AUTOMATION_SCORE_DB_PATH;
  if (configured) {
    const current = resolve(configured);
    const legacySibling = resolve(dirname(current), 'repo-automation-score.sqlite');
    if (
      basename(current) === 'agent-automation-score.sqlite'
      && !existsSync(current)
      && existsSync(legacySibling)
    ) {
      return legacySibling;
    }
    return current;
  }

  const current = resolve(root, 'data', 'agent-automation-score.sqlite');
  const legacy = resolve(root, 'data', 'repo-automation-score.sqlite');
  return existsSync(current) || !existsSync(legacy) ? current : legacy;
}

export function ensureDatabaseDirectory(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  return path;
}
