import { NavLink, useNavigate } from 'react-router-dom';
import {
  Building2,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  Gauge,
  Activity,
  CreditCard,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/properties', icon: Building2, label: 'Propiedades' },
  { to: '/departments', icon: DoorOpen, label: 'Departamentos' },
  { to: '/tenants', icon: Users, label: 'Inquilinos' },
  { to: '/contracts', icon: FileText, label: 'Contratos' },
  { to: '/receipts', icon: Receipt, label: 'Recibos' },
  { to: '/meters', icon: Gauge, label: 'Medidores' },
  { to: '/readings', icon: Activity, label: 'Lecturas' },
  { to: '/payments', icon: CreditCard, label: 'Pagos' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  async function handleLogout() {
    await logout();
    void navigate('/login', { replace: true });
  }

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
      isActive
        ? 'bg-white/[0.14] text-white shadow-sm shadow-black/10 ring-1 ring-white/[0.08]'
        : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100 active:bg-white/[0.10]',
    );

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
          <Building2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-display text-[15px] font-bold tracking-tight truncate bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            PropManager
          </span>
        )}
      </div>

      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={closeMobile}
            className={navLinkCls}
          >
            <item.icon
              size={18}
              className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <>
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pt-3 pb-1">
                Admin
              </p>
            )}
            <NavLink
              to="/admin/users"
              onClick={closeMobile}
              className={navLinkCls}
            >
              <ShieldCheck
                size={18}
                className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
              />
              {!collapsed && <span className="truncate">Usuarios</span>}
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-white/[0.06] px-2.5 py-2">
        {user && !collapsed && (
          <p className="text-[11px] text-slate-500 truncate px-3 pb-1">
            {user.email}
          </p>
        )}
        <button
          onClick={() => void handleLogout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:bg-white/[0.07] hover:text-slate-100 active:bg-white/[0.10] transition-all duration-150"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      <ThemeToggle collapsed={collapsed} />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex items-center justify-center h-11 border-t border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-all duration-150"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border shadow-md text-on-surface-medium hover:text-on-surface transition-colors"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <aside
        className={cn(
          'bg-gradient-to-b from-sidebar to-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out',
          'hidden md:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={closeMobile}
        >
          <aside
            className="bg-gradient-to-b from-sidebar to-slate-900 text-white flex flex-col w-72 h-full shadow-2xl animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeMobile}
              className="flex items-center justify-center h-12 w-12 self-end text-slate-400 hover:text-white transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
            <div className="flex-1 flex flex-col overflow-hidden -mt-3">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
