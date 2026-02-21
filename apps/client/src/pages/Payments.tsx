import { useState, useEffect } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { inputCls, btnPrimaryCls } from '../lib/styles';
import DatePicker from '../components/DatePicker';

interface Contract {
  id: string;
  tenant: { name: string };
  department: { name: string };
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  description?: string;
  type: 'rent' | 'water' | 'light' | 'advance' | 'guarantee' | 'refund';
  contract: Contract;
}

const typeLabels: Record<Payment['type'], string> = {
  rent: 'Alquiler',
  water: 'Agua',
  light: 'Luz',
  advance: 'Adelanto',
  guarantee: 'Garantia',
  refund: 'Devolucion',
};

const typeColors: Record<Payment['type'], string> = {
  rent: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  water: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  light: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  advance: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  guarantee: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  refund: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Payment['type']>('rent');
  const [contractId, setContractId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Payment[]>('/payments'),
      apiFetch<Contract[]>('/contracts'),
    ])
      .then(([p, c]) => { setPayments(p); setContracts(c); })
      .catch(() => setError('No se pudieron cargar los pagos'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date || !contractId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(amount),
        date,
        type,
        contractId: contractId,
      };
      if (description) body.description = description;
      const added = await apiPost<Payment>('/payments', body);
      setPayments((prev) => [...prev, added]);
      setAmount('');
      setDate('');
      setDescription('');
      setContractId('');
      setModalOpen(false);
    } catch {
      setError('Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={CreditCard}
        title="Pagos"
        subtitle={`${payments.length} pagos registrados`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Pago"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
          {error}
        </div>
      )}

      {payments.length > 0 && (
        <div className="mb-6 bg-surface rounded-2xl border border-border p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-950/30 to-emerald-100 dark:to-emerald-900/40 flex items-center justify-center ring-1 ring-emerald-200/50 dark:ring-emerald-700/40">
            <DollarSign size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-on-surface-muted">Total recaudado</p>
            <p className="text-2xl font-bold text-on-surface">S/ {totalAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="Sin pagos" description="Registra pagos asociados a contratos activos." />
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt/80">
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Tipo</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Contrato</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Descripcion</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Fecha</th>
                <th className="text-right px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[p.type]}`}>
                      {typeLabels[p.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    #{p.contract?.id} - {p.contract?.tenant?.name || 'N/A'}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-medium max-w-xs truncate">
                    {p.description || '-'}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    {new Date(p.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    S/ {p.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Pago">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Contrato</label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar contrato...</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.tenant?.name} ({c.department?.name})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Monto</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500.00" required className={inputCls} />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as Payment['type'])} className={inputCls}>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Fecha</label>
            <DatePicker value={date} onChange={setDate} required />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Descripcion (opcional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pago mensual enero" className={inputCls} />
          </div>
          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Registrar Pago'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
