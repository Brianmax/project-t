import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { inputCls, labelCls, btnPrimaryCls } from '../lib/styles';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      void navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 mb-4">
            <Building2 size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface-strong tracking-tight">PropManager</h1>
          <p className="text-sm text-on-surface-muted mt-1">Inicia sesión en tu cuenta</p>
        </div>

        <div className="bg-surface-raised rounded-2xl border border-border p-6 shadow-sm">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className={labelCls}>Correo electrónico</label>
              <input
                type="email"
                className={inputCls}
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className={labelCls}>Contraseña</label>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-status-danger-fg bg-status-danger-bg border border-status-danger-border rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className={btnPrimaryCls} disabled={loading}>
              <span className="flex items-center justify-center gap-2">
                <LogIn size={16} />
                {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </span>
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-muted mt-4">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
