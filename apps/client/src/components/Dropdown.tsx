import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
  rightSlot?: ReactNode;
  disabled?: boolean;
  searchText?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  emptyMessage?: string;
}

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  required = false,
  className = '',
  emptyMessage = 'Sin opciones',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (open && highlight >= 0) {
      optionRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, open]);

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        const initial = Math.max(
          options.findIndex((o) => o.value === value),
          0,
        );
        setHighlight(initial);
      } else {
        setHighlight(-1);
      }
      return next;
    });
  };

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    setHighlight(-1);
    triggerRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => {
        let next = h + 1;
        while (next < options.length && options[next]?.disabled) next++;
        return next >= options.length ? h : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => {
        let next = h - 1;
        while (next >= 0 && options[next]?.disabled) next--;
        return next < 0 ? h : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[highlight];
      if (opt && !opt.disabled) commit(opt.value);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  };

  const triggerClasses = [
    'w-full px-3 py-2.5 rounded-xl bg-surface-alt border text-sm text-left',
    'flex items-center justify-between gap-2 transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
    open ? 'border-primary-500/60' : 'border-border',
    disabled
      ? 'opacity-50 cursor-not-allowed'
      : 'hover:border-border-ring cursor-pointer',
    className,
  ].join(' ');

  return (
    <div className="relative" onKeyDown={handleKey}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        onClick={toggleOpen}
        className={triggerClasses}
      >
        <span
          className={`flex-1 truncate ${selected ? 'text-on-surface' : 'text-on-surface-faint'}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-on-surface-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full max-h-72 overflow-auto rounded-xl bg-surface-raised border border-border shadow-lg ring-1 ring-black/5 dark:ring-white/5 animate-fade-in"
        >
          {options.length === 0 ? (
            <div className="px-3 py-3 text-sm text-on-surface-muted text-center">
              {emptyMessage}
            </div>
          ) : (
            <ul className="py-1">
              {options.map((opt, i) => {
                const isSelected = opt.value === value;
                const isHighlight = i === highlight;
                return (
                  <li
                    key={opt.value}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled}
                    onMouseEnter={() => !opt.disabled && setHighlight(i)}
                    onClick={() => !opt.disabled && commit(opt.value)}
                    className={[
                      'px-3 py-2 cursor-pointer flex items-start gap-2 text-sm',
                      opt.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : isHighlight
                          ? 'bg-primary-500/10'
                          : '',
                      isSelected ? 'text-on-surface-strong' : 'text-on-surface',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.hint && (
                        <div className="text-xs text-on-surface-muted truncate mt-0.5">
                          {opt.hint}
                        </div>
                      )}
                    </div>
                    {opt.rightSlot && (
                      <div className="shrink-0 text-xs text-on-surface-medium self-center">
                        {opt.rightSlot}
                      </div>
                    )}
                    {isSelected && (
                      <Check
                        size={14}
                        className="shrink-0 text-primary-600 dark:text-primary-400 self-center"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
