import { useEffect, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  menuRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export default function FloatingMenuPanel({ menuRef, triggerRef, onClose, children }: Props) {
  const rect = triggerRef.current?.getBoundingClientRect();

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') { onClose(); return; }
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
      if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (current + 1) % items.length : current <= 0 ? items.length - 1 : current - 1;
      items[next]?.focus();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    menuRef.current?.querySelector<HTMLElement>('[role="option"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      triggerRef.current?.focus();
    };
  }, [menuRef, onClose, triggerRef]);

  if (!rect) return null;
  return createPortal(<div ref={menuRef} role="listbox" className="floating-menu-panel" style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}>{children}</div>, document.body);
}
