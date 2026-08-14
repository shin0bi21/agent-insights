import { useId, useRef, useState } from 'react';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';

export default function RunRequestMenu({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  return <>
    <button ref={triggerRef} className="request-menu-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}>View Request</button>
    {open && <FloatingMenuPanel menuRef={menuRef} triggerRef={triggerRef} onClose={() => setOpen(false)} role="dialog" labelledBy={titleId} panelWidth={420}>
      <div className="request-menu-content"><strong id={titleId}>Feature request</strong><p>{description}</p></div>
    </FloatingMenuPanel>}
  </>;
}
