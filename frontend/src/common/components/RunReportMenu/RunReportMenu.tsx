import { useId, useRef, useState } from 'react';
import type { ComparisonRow, RunRecord } from '../../../types';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import ImplementationReview from '../ImplementationReview/ImplementationReview';

function reportDuration(milliseconds: number | null) { if (milliseconds === null) return '—'; const seconds = Math.floor(milliseconds / 1000); return `${Math.floor(seconds / 60)}m ${seconds % 60}s`; }
const number = (value: number) => new Intl.NumberFormat().format(value ?? 0);
const contractLabel = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function RunReportMenu({ result, run }: { result: ComparisonRow; run: Pick<RunRecord, 'provider' | 'model' | 'reasoningEffort'> }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const misses = Object.keys(result.missedRequirements);
  const uncachedInput = Math.max(0, (result.inputTokens ?? 0) - (result.cachedInputTokens ?? 0));
  const cacheRate = result.inputTokens ? Math.round(1000 * (result.cachedInputTokens ?? 0) / result.inputTokens) / 10 : 0;
  return <><button ref={triggerRef} className="request-menu-trigger report-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>View Report</button>{open && <FloatingMenuPanel menuRef={menuRef} triggerRef={triggerRef} onClose={() => setOpen(false)} role="dialog" labelledBy={titleId} panelWidth={720} placement="centered"><div className="run-menu-content report-menu-content"><h2 id={titleId} className="sr-only">Report</h2><h3>Overview</h3><div className="report-metrics"><div><span>Score</span><b>{result.medianScore ?? '—'}%</b></div><div><span>Time</span><b>{reportDuration(result.medianDurationMs)}</b></div><div><span>Total tokens</span><b>{number((result.inputTokens ?? 0) + (result.outputTokens ?? 0))}</b></div></div><h3>Agent overview</h3><dl className="agent-breakdown"><div><dt>Provider</dt><dd>{run.provider ?? 'codex'}</dd></div><div><dt>Agent</dt><dd>{run.model.replace('gpt-5.6-', '')}</dd></div><div><dt>Reasoning</dt><dd>{run.reasoningEffort}</dd></div></dl><h3>Token usage</h3><dl className="token-breakdown"><div><dt>Input</dt><dd>{number(result.inputTokens)}</dd></div><div><dt>Cached input</dt><dd>{number(result.cachedInputTokens)} <small>{cacheRate}%</small></dd></div><div><dt>Uncached input</dt><dd>{number(uncachedInput)}</dd></div><div><dt>Output</dt><dd>{number(result.outputTokens)}</dd></div></dl><h3>Structural review</h3><div className={`structural-review ${misses.length ? 'missing' : 'complete'}`}><strong>{misses.length ? `Missing structural contracts: ${misses.map(contractLabel).join(', ')}.` : 'All structural contracts found.'}</strong></div>{result.implementationReview?.length ? <ImplementationReview sections={result.implementationReview}/> : <p>No implementation breakdown was produced.</p>}</div></FloatingMenuPanel>}</>;
}
