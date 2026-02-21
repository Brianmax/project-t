import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
}

export default function PageHeader({ icon: Icon, title, subtitle, onAdd, addLabel }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-50 dark:from-primary-950/40 to-primary-100 dark:to-primary-900/40 flex items-center justify-center ring-1 ring-primary-200/60 dark:ring-primary-700/40 shadow-sm shadow-primary-500/10">
          <Icon size={21} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold text-on-surface tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-[13px] text-on-surface-muted mt-0.5 font-normal">{subtitle}</p>}
        </div>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm shadow-primary-600/20 hover:shadow-md hover:shadow-primary-600/30 transition-all duration-150"
        >
          <Plus size={17} strokeWidth={2.5} />
          {addLabel || 'Agregar'}
        </button>
      )}
    </div>
  );
}
