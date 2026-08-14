const allowedHosts = new Set(['127.0.0.1', '0.0.0.0', '::1', '::']);

export function resolveServerHost(environment: NodeJS.ProcessEnv = process.env) {
  const host = environment.REPO_AUTOMATION_SCORE_HOST?.trim() || '127.0.0.1';
  if (!allowedHosts.has(host)) {
    throw new Error('REPO_AUTOMATION_SCORE_HOST must be a loopback or all-interface bind address.');
  }
  return host;
}
