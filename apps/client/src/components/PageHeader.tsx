import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  onAdd,
  addLabel,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 md:mb-8 gap-4">
      <div className="flex items-center gap-3 md:gap-3.5 min-w-0">
        <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary-50 dark:from-primary-950/40 to-primary-100 dark:to-primary-900/40 flex items-center justify-center ring-1 ring-primary-200/60 dark:ring-primary-700/40 shadow-sm shadow-primary-500/10 flex-shrink-0">
          <Icon size={20} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-[22px] font-extrabold text-on-surface tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] md:text-[13px] text-on-surface-muted mt-0.5 font-normal truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {onAdd && (
          <button
            onClick={onAdd}
            className={cn(
              'inline-flex items-center gap-2 px-3 md:px-4 py-2.5',
              'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 active:scale-[0.98]',
              'text-white text-sm font-semibold rounded-xl',
              'shadow-sm shadow-primary-600/20 hover:shadow-md hover:shadow-primary-600/30',
              'transition-all duration-150 flex-shrink-0',
            )}
          >
            <Plus size={17} strokeWidth={2.5} />
            <span className="hidden sm:inline">{addLabel || 'Agregar'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
