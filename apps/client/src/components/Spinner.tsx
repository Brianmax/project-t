import { Loader2 } from 'lucide-react';

export default function Spinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary-500/20 animate-ping opacity-20" />
        <Loader2 size={32} className="text-primary-500 animate-spin" />
      </div>
      <p className="text-[13px] text-on-surface-faint font-medium mt-4">
        {text}
      </p>
    </div>
  );
}
