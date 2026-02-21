import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-surface-alt to-surface-raised flex items-center justify-center mb-5 ring-1 ring-border shadow-sm">
        <Icon size={26} className="text-on-surface-faint" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-on-surface-medium mb-1.5 tracking-tight">{title}</h3>
      <p className="text-sm text-on-surface-muted max-w-xs leading-relaxed">{description}</p>
    </div>
  );
}
