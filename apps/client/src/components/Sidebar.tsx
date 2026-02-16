import { NavLink } from 'react-router-dom';
import {
  Building2,
  DoorOpen,
  Users,
  FileText,
  Gauge,
  Activity,
  CreditCard,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/properties', icon: Building2, label: 'Propiedades' },
  { to: '/departments', icon: DoorOpen, label: 'Departamentos' },
  { to: '/tenants', icon: Users, label: 'Inquilinos' },
  { to: '/contracts', icon: FileText, label: 'Contratos' },
  { to: '/meters', icon: Gauge, label: 'Medidores' },
  { to: '/readings', icon: Activity, label: 'Lecturas' },
  { to: '/payments', icon: CreditCard, label: 'Pagos' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-sidebar text-white flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight truncate">
            PropManager
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-white/10 text-slate-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
