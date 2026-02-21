import { Loader2 } from 'lucide-react';

export default function Spinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <Loader2 size={28} className="text-primary-500 animate-spin mb-3" />
      <p className="text-[13px] text-on-surface-faint font-medium">{text}</p>
    </div>
  );
}
