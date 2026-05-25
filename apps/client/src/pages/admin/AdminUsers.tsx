import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { cardCls, btnPrimaryCls, btnDangerCls } from '../../lib/styles';
import { showSuccess, showError } from '../../lib/toast';
import { formatDate } from '../../lib/utils';
import PageHeader from '../../components/PageHeader';
import { PageSkeleton } from '../../components/Skeleton';

interface AdminUser {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const statusBadge: Record<AdminUser['status'], string> = {
  pending:
    'bg-status-warning-bg text-status-warning-fg border border-status-warning-border',
  approved:
    'bg-status-success-bg text-status-success-fg border border-status-success-border',
  rejected:
    'bg-status-danger-bg text-status-danger-fg border border-status-danger-border',
};

const statusLabel: Record<AdminUser['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AdminUser[]>('/admin/users')
      .then(setUsers)
      .catch(() => showError('No se pudieron cargar los usuarios'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setUpdating(id);
    try {
      await apiFetch(`/admin/users/${id}/${action}`, { method: 'PATCH' });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? { ...u, status: action === 'approve' ? 'approved' : 'rejected' }
            : u,
        ),
      );
      showSuccess(
        action === 'approve' ? 'Usuario aprobado' : 'Usuario rechazado',
      );
    } catch {
      showError('Error al actualizar el estado');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona el acceso de los usuarios registrados"
        icon={ShieldCheck}
      />

      {loading ? (
        <PageSkeleton />
      ) : users.length === 0 ? (
        <div className={cardCls}>
          <p className="text-on-surface-muted text-sm text-center py-4">
            No hay usuarios registrados.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-on-surface-medium">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-on-surface-medium">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-semibold text-on-surface-medium hidden sm:table-cell">
                  Registrado
                </th>
                <th className="text-right px-4 py-3 font-semibold text-on-surface-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-surface-alt transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-on-surface">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge[user.status]}`}
                    >
                      {statusLabel[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-muted hidden sm:table-cell">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {user.status !== 'approved' && (
                        <button
                          onClick={() => void handleAction(user.id, 'approve')}
                          disabled={updating === user.id}
                          className={`${btnPrimaryCls} !w-auto !py-1.5 px-3 text-xs`}
                        >
                          Aprobar
                        </button>
                      )}
                      {user.status !== 'rejected' && (
                        <button
                          onClick={() => void handleAction(user.id, 'reject')}
                          disabled={updating === user.id}
                          className={`${btnDangerCls} !py-1.5 px-3 text-xs`}
                        >
                          Rechazar
                        </button>
                      )}
                      {user.status === 'rejected' && (
                        <span className="text-xs text-on-surface-faint">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
