import { useRef, useState } from 'react';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import './FloatingSelect.css';

export interface FloatingSelectOption { value: string; label: string }

interface Props {
  id: string;
  value: string;
  options: readonly FloatingSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function FloatingSelect({ id, value, options, onChange, placeholder = 'Select an option', disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);

  return <>
    <button ref={triggerRef} id={id} type="button" className="floating-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setOpen(true); } }}>
      <span className={selected ? undefined : 'floating-select-placeholder'}>{selected?.label ?? placeholder}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <FloatingMenuPanel menuRef={menuRef} triggerRef={triggerRef} onClose={() => setOpen(false)}>{options.length ? options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>) : <span className="floating-select-empty">No options available</span>}</FloatingMenuPanel>}
  </>;
}
