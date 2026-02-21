import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDisplay(s: string): string {
  const date = parseDate(s);
  if (!date) return '';
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── DayPicker classNames ───────────────────────────────────────────────────────

const dayPickerClassNames = {
  root: 'p-3 select-none',
  months: '',
  month_caption: 'flex items-center justify-between px-1 mb-2',
  caption_label: 'text-sm font-semibold text-on-surface capitalize',
  nav: 'flex items-center gap-0.5',
  button_previous:
    'w-7 h-7 inline-flex items-center justify-center rounded-lg text-on-surface-medium ' +
    'hover:bg-surface-raised hover:text-on-surface transition-colors duration-150',
  button_next:
    'w-7 h-7 inline-flex items-center justify-center rounded-lg text-on-surface-medium ' +
    'hover:bg-surface-raised hover:text-on-surface transition-colors duration-150',
  month_grid: 'w-full',
  weekdays: 'flex mb-1',
  weekday: 'w-9 h-7 flex items-center justify-center text-[10px] font-bold text-on-surface-ghost uppercase tracking-wider',
  week: 'flex',
  day: '',
  day_button:
    'w-9 h-9 text-sm rounded-xl font-medium text-on-surface transition-all duration-150 ' +
    'hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer',
  selected: '!bg-primary-600 !text-white hover:!bg-primary-700 shadow-sm shadow-primary-600/20',
  today: '!font-bold !text-primary-600',
  outside: '!text-on-surface-ghost opacity-30',
  disabled: '!opacity-25 !cursor-not-allowed pointer-events-none',
  hidden: 'invisible',
};

// ── Component ──────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  required,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = parseDate(value);

  // Position the popover below the trigger
  const openPopover = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerCls = [
    'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm text-left',
    'outline-none transition-all duration-200 bg-surface',
    value ? 'text-on-surface' : 'text-on-surface-faint',
    open
      ? 'border-primary-500 ring-4 ring-primary-500/10 dark:ring-primary-400/15'
      : 'border-border hover:border-on-surface-ghost',
    disabled ? 'bg-surface-alt text-on-surface-faint cursor-not-allowed' : 'cursor-pointer',
  ].join(' ');

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPopover()}
        disabled={disabled}
        className={triggerCls}
      >
        <Calendar size={15} className="text-on-surface-faint flex-shrink-0" />
        <span className="flex-1 truncate">
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {/* Hidden native input for required validation */}
      {required && (
        <input
          tabIndex={-1}
          type="text"
          value={value}
          onChange={() => {}}
          required
          aria-hidden="true"
          className="absolute inset-0 w-full opacity-0 pointer-events-none"
        />
      )}

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-surface border border-border rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 animate-slide-up"
        >
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={(date) => {
              if (date) { onChange(toISO(date)); setOpen(false); }
            }}
            components={{
              Chevron: ({ orientation }: { orientation?: string }) =>
                orientation === 'left' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />,
            }}
            classNames={dayPickerClassNames}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
