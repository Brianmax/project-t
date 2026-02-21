import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  DoorOpen,
  Users,
  FileText,
  CreditCard,
  ArrowRight,
  TrendingUp,
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
  { key: 'properties' as const, label: 'Propiedades', icon: Building2, to: '/properties', gradient: 'from-blue-500 to-blue-600', containerCls: 'bg-blue-50 dark:bg-blue-950/40 ring-blue-100 dark:ring-blue-800/40', iconCls: 'text-blue-600 dark:text-blue-400' },
  { key: 'departments' as const, label: 'Departamentos', icon: DoorOpen, to: '/departments', gradient: 'from-violet-500 to-violet-600', containerCls: 'bg-violet-50 dark:bg-violet-950/40 ring-violet-100 dark:ring-violet-800/40', iconCls: 'text-violet-600 dark:text-violet-400' },
  { key: 'tenants' as const, label: 'Inquilinos', icon: Users, to: '/tenants', gradient: 'from-emerald-500 to-emerald-600', containerCls: 'bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-100 dark:ring-emerald-800/40', iconCls: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'contracts' as const, label: 'Contratos', icon: FileText, to: '/contracts', gradient: 'from-amber-500 to-amber-600', containerCls: 'bg-amber-50 dark:bg-amber-950/40 ring-amber-100 dark:ring-amber-800/40', iconCls: 'text-amber-600 dark:text-amber-400' },
  { key: 'payments' as const, label: 'Pagos', icon: CreditCard, to: '/payments', gradient: 'from-rose-500 to-rose-600', containerCls: 'bg-rose-50 dark:bg-rose-950/40 ring-rose-100 dark:ring-rose-800/40', iconCls: 'text-rose-600 dark:text-rose-400' },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<unknown[]>('/properties'),
      apiFetch<unknown[]>('/departments'),
      apiFetch<unknown[]>('/tenants'),
      apiFetch<unknown[]>('/contracts'),
      apiFetch<unknown[]>('/payments'),
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
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50 dark:from-primary-950/40 to-primary-100 dark:to-primary-900/40 flex items-center justify-center ring-1 ring-primary-200/50 dark:ring-primary-700/40">
            <TrendingUp size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Dashboard</h1>
            <p className="text-[13px] text-on-surface-muted">Resumen general del sistema</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <Link
            key={card.key}
            to={card.to}
            className="group relative bg-surface rounded-2xl border border-border p-5 hover:shadow-lg hover:shadow-shadow hover:border-border transition-all duration-200 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${card.containerCls} ring-1 flex items-center justify-center`}>
                <card.icon size={19} className={card.iconCls} />
              </div>
              <ArrowRight
                size={15}
                className="text-on-surface-ghost group-hover:text-on-surface-muted group-hover:translate-x-0.5 transition-all duration-200"
              />
            </div>
            <p className="text-3xl font-bold text-on-surface tracking-tight">{stats?.[card.key] ?? 0}</p>
            <p className="text-[13px] text-on-surface-muted mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
