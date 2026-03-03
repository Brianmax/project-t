import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Building2, UserPlus, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { inputCls, labelCls, btnPrimaryCls } from '../lib/styles';

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  const header = (
    <div className="flex flex-col items-center mb-8">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 mb-4">
        <Building2 size={22} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-on-surface-strong tracking-tight">PropManager</h1>
      <p className="text-sm text-on-surface-muted mt-1">Crea tu cuenta</p>
    </div>
  );

  if (registered) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {header}
          <div className="bg-surface-raised rounded-2xl border border-border p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-status-warning-bg border border-status-warning-border flex items-center justify-center mx-auto mb-4">
              <Clock size={22} className="text-status-warning-fg" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface-strong mb-2">¡Cuenta creada!</h2>
            <p className="text-sm text-on-surface-muted">
              Un administrador revisará y aprobará tu acceso. Recibirás confirmación pronto.
            </p>
          </div>
          <p className="text-center text-sm text-on-surface-muted mt-4">
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {header}

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
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmar contraseña</label>
              <input
                type="password"
                className={inputCls}
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-status-danger-fg bg-status-danger-bg border border-status-danger-border rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className={btnPrimaryCls} disabled={loading}>
              <span className="flex items-center justify-center gap-2">
                <UserPlus size={16} />
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </span>
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-on-surface-muted mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
