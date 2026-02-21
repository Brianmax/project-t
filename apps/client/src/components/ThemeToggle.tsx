import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center gap-2 mx-2.5 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-150"
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {!collapsed && (
        <span className="text-[13px] font-medium truncate">
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </span>
      )}
    </button>
  );
}
