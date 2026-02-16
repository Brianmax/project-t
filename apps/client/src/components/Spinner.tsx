import { Loader2 } from 'lucide-react';

export default function Spinner({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <Loader2 size={32} className="text-primary-500 animate-spin mb-3" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
