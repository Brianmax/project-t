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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <Icon size={22} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus size={18} />
          {addLabel || 'Agregar'}
        </button>
      )}
    </div>
  );
}
