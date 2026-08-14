import { useId, useRef, useState } from 'react';
import type { RunRecord } from '../../../types';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';

export default function RunJobMenu({ run, worktree }: { run: RunRecord; worktree: string | null }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const settings = [['Agent', `${run.provider ?? 'codex'} / ${run.model.replace('gpt-5.6-', '')}`], ['Reasoning', run.reasoningEffort], ['Feature type', run.featureType ?? 'full-stack']];
  const paths = [['Benchmark worktree', worktree], ['Local artifacts', run.artifactPath]].filter((row): row is string[] => Boolean(row[1]));
  const item = ([label, value]: string[]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>;
  return <><button ref={triggerRef} className="request-menu-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>View Job Configuration</button>{open && <FloatingMenuPanel menuRef={menuRef} triggerRef={triggerRef} onClose={() => setOpen(false)} role="dialog" labelledBy={titleId} panelWidth={620}><div className="run-menu-content"><strong id={titleId}>Job configuration</strong><dl className="job-settings-row">{settings.map(item)}</dl><dl className="job-paths">{paths.map(item)}</dl></div></FloatingMenuPanel>}</>;
}
