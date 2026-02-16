import { useState, useEffect } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Contract {
  id: number;
  tenant: { name: string };
  department: { name: string };
}

interface Payment {
  id: number;
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
  rent: 'bg-blue-100 text-blue-700',
  water: 'bg-cyan-100 text-cyan-700',
  light: 'bg-amber-100 text-amber-700',
  advance: 'bg-violet-100 text-violet-700',
  guarantee: 'bg-emerald-100 text-emerald-700',
  refund: 'bg-rose-100 text-rose-700',
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
      apiFetch<Payment[]>('/payment'),
      apiFetch<Contract[]>('/contract'),
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
        contractId: Number(contractId),
      };
      if (description) body.description = description;
      const added = await apiPost<Payment>('/payment', body);
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm";

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
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {payments.length > 0 && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <DollarSign size={24} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total recaudado</p>
            <p className="text-2xl font-bold text-slate-900">S/ {totalAmount.toFixed(2)}</p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="Sin pagos" description="Registra pagos asociados a contratos activos." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Contrato</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Descripcion</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Fecha</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[p.type]}`}>
                      {typeLabels[p.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    #{p.contract?.id} - {p.contract?.tenant?.name || 'N/A'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                    {p.description || '-'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {new Date(p.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Contrato</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500.00" required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as Payment['type'])} className={inputCls}>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion (opcional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pago mensual enero" className={inputCls} />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors">
            {submitting ? 'Guardando...' : 'Registrar Pago'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
