import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  DoorOpen,
  Users,
  FileText,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import Spinner from '../components/Spinner';

interface Stats {
  properties: number;
  departments: number;
  tenants: number;
  contracts: number;
  payments: number;
}

const cards = [
  { key: 'properties' as const, label: 'Propiedades', icon: Building2, to: '/properties', color: 'bg-blue-500' },
  { key: 'departments' as const, label: 'Departamentos', icon: DoorOpen, to: '/departments', color: 'bg-violet-500' },
  { key: 'tenants' as const, label: 'Inquilinos', icon: Users, to: '/tenants', color: 'bg-emerald-500' },
  { key: 'contracts' as const, label: 'Contratos', icon: FileText, to: '/contracts', color: 'bg-amber-500' },
  { key: 'payments' as const, label: 'Pagos', icon: CreditCard, to: '/payments', color: 'bg-rose-500' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<unknown[]>('/property'),
      apiFetch<unknown[]>('/department'),
      apiFetch<unknown[]>('/tenant'),
      apiFetch<unknown[]>('/contract'),
      apiFetch<unknown[]>('/payment'),
    ])
      .then(([p, d, t, c, pay]) =>
        setStats({
          properties: p.length,
          departments: d.length,
          tenants: t.length,
          contracts: c.length,
          payments: pay.length,
        }),
      )
      .catch(() => setStats({ properties: 0, departments: 0, tenants: 0, contracts: 0, payments: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Cargando dashboard..." />;

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {cards.map((card) => (
          <Link
            key={card.key}
            to={card.to}
            className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center`}>
                <card.icon size={20} className="text-white" />
              </div>
              <ArrowRight
                size={16}
                className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"
              />
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats?.[card.key] ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
