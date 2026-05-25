import { useState, useEffect } from 'react';
import { CreditCard, DollarSign } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/Skeleton';
import Modal from '../components/Modal';
import {
  inputCls,
  btnPrimaryCls,
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../lib/styles';
import DatePicker from '../components/DatePicker';
import Dropdown from '../components/Dropdown';
import { showSuccess, showError } from '../lib/toast';
import { formatDate } from '../lib/utils';

interface Contract {
  id: string;
  tenant: { name: string };
  department: { name: string };
}

type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'yape'
  | 'plin'
  | 'other';

interface UnpaidReceipt {
  id: string;
  contractId: string;
  month: number;
  year: number;
  period: string;
  totalDue: number;
  balance: number;
}

interface LedgerReceiptSnapshot {
  id: string;
  month: number;
  year: number;
  totalDue: number;
  appliedCredit: number;
  remaining: number;
  status: 'paid' | 'unpaid';
  paidAt: string | null;
}

interface LedgerSnapshot {
  contractId: string;
  totalPaid: number;
  totalBilled: number;
  balance: number;
  receipts: LedgerReceiptSnapshot[];
  creditRemaining: number;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  description?: string;
  method: PaymentMethod;
  reference: string | null;
  receiptId: string | null;
  contract: Contract;
}

const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  other: 'Otro',
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [unpaidReceipts, setUnpaidReceipts] = useState<UnpaidReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<LedgerSnapshot | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [contractId, setContractId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Payment[]>('/payments'),
      apiFetch<Contract[]>('/contracts'),
      apiFetch<UnpaidReceipt[]>('/contracts/receipts/unpaid'),
    ])
      .then(([p, c, r]) => {
        setPayments(p);
        setContracts(c);
        setUnpaidReceipts(r);
      })
      .catch(() => showError('No se pudieron cargar los pagos'))
      .finally(() => setLoading(false));
  }, []);

  // Only show the most recent unpaid receipt per contract. Older unpaid
  // receipts are hidden because their outstanding balance is already
  // included in the newest receipt's carry-forward. FIFO ledger still
  // applies payments to the oldest receipt first regardless of which one
  // the operator selects.
  const contractReceipts = contractId
    ? unpaidReceipts
        .filter((r) => r.contractId === contractId)
        .sort((a, b) =>
          a.year !== b.year ? b.year - a.year : b.month - a.month,
        )
        .slice(0, 1)
    : [];

  const handleContractChange = (value: string) => {
    setContractId(value);
    setReceiptId('');
    setLedger(null);
    if (value) {
      apiFetch<LedgerSnapshot>(`/contracts/${value}/ledger`)
        .then(setLedger)
        .catch(() => setLedger(null));
    }
  };

  const handleReceiptChange = (value: string) => {
    setReceiptId(value);
    if (value && ledger) {
      // Pre-fill with the contract's total outstanding so the operator can
      // settle everything (current bills + carried-forward arrears) in one
      // payment. They can still edit it down for partial payments.
      const totalOwed = Math.max(-ledger.balance, 0);
      if (totalOwed > 0 && !amount) setAmount(totalOwed.toFixed(2));
    } else if (value) {
      const r = unpaidReceipts.find((x) => x.id === value);
      if (r && !amount) setAmount((-r.balance).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !date || !contractId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(amount),
        date,
        method,
        contractId,
      };
      if (reference) body.reference = reference;
      if (description) body.description = description;
      if (receiptId) body.receiptId = receiptId;
      const added = await apiPost<Payment>('/payments', body);
      setPayments((prev) => [added, ...prev]);
      setAmount('');
      setDate('');
      setDescription('');
      setReference('');
      setMethod('cash');
      setContractId('');
      setReceiptId('');
      setModalOpen(false);
      showSuccess('Pago registrado exitosamente');
    } catch {
      showError('Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  if (loading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={CreditCard}
        title="Pagos"
        subtitle={`${payments.length} pagos registrados`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Pago"
      />

      {payments.length > 0 && (
        <div className="mb-6 bg-surface rounded-2xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shadow-sm">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-950/30 to-emerald-100 dark:to-emerald-900/40 flex items-center justify-center ring-1 ring-emerald-200/50 dark:ring-emerald-700/40 flex-shrink-0">
            <DollarSign
              size={22}
              className="text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <div>
            <p className="text-sm text-on-surface-muted">Total recaudado</p>
            <p className="text-xl sm:text-2xl font-bold text-on-surface">
              S/ {totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sin pagos"
          description="Registra pagos asociados a contratos activos."
        />
      ) : (
        <div className={tableContainerCls}>
          <table className="w-full text-sm">
            <thead>
              <tr className={tableHeaderCls}>
                <th className={tableHeaderCellCls}>Contrato</th>
                <th className={`${tableHeaderCellCls} hidden sm:table-cell`}>
                  Metodo
                </th>
                <th className={`${tableHeaderCellCls} hidden md:table-cell`}>
                  Referencia
                </th>
                <th className={tableHeaderCellCls}>Fecha</th>
                <th className={`${tableHeaderCellCls} text-right`}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={tableRowCls}>
                  <td className={`${tableCellCls} text-on-surface-medium`}>
                    {p.contract?.tenant?.name || 'N/A'}
                  </td>
                  <td
                    className={`${tableCellCls} text-on-surface-medium hidden sm:table-cell`}
                  >
                    {methodLabels[p.method] ?? p.method}
                  </td>
                  <td
                    className={`${tableCellCls} text-on-surface-medium hidden md:table-cell max-w-xs truncate`}
                  >
                    {p.reference || '-'}
                  </td>
                  <td className={`${tableCellCls} text-on-surface-medium`}>
                    {formatDate(p.date)}
                  </td>
                  <td
                    className={`${tableCellCls} text-right font-semibold ${Number(p.amount) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                  >
                    S/ {Number(p.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo Pago"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Contrato
            </label>
            <Dropdown
              value={contractId}
              onChange={handleContractChange}
              required
              placeholder="Seleccionar contrato..."
              options={contracts.map((c) => ({
                value: c.id,
                label: c.tenant?.name ?? '—',
                hint: c.department?.name,
              }))}
            />
          </div>
          {contractReceipts.length > 0 && (
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Recibo (opcional)
              </label>
              <Dropdown
                value={receiptId}
                onChange={handleReceiptChange}
                placeholder="Sin recibo (pago independiente)"
                options={[
                  {
                    value: '',
                    label: 'Sin recibo (pago independiente)',
                    hint: 'No se aplica a ningún recibo en particular',
                  },
                  ...contractReceipts.map((r) => {
                    const snap = ledger?.receipts.find((lr) => lr.id === r.id);
                    // Show the contract's total outstanding (this receipt's
                    // own remaining + any arrears from older receipts that
                    // are now folded into this one's carry-forward).
                    const totalOwed = ledger
                      ? Math.max(-ledger.balance, 0)
                      : snap
                        ? snap.remaining
                        : -r.balance;
                    return {
                      value: r.id,
                      label: r.period,
                      hint: 'Saldo total del contrato',
                      rightSlot: (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          S/ {totalOwed.toFixed(2)}
                        </span>
                      ),
                    };
                  }),
                ]}
              />
            </div>
          )}
          {receiptId && ledger && (
            <div className="mt-1.5 px-3 py-2 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/40 dark:border-blue-700/30 text-[12px] animate-fade-in space-y-1">
              {(() => {
                const snap = ledger.receipts.find((lr) => lr.id === receiptId);
                if (!snap) return null;
                const totalOwed = Math.max(-ledger.balance, 0);
                const currentReceiptUnpaid = snap.remaining;
                const olderArrears = Math.max(
                  totalOwed - currentReceiptUnpaid,
                  0,
                );
                return (
                  <>
                    {olderArrears > 0.005 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span>Saldo de meses anteriores</span>
                        <span>S/ {olderArrears.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-on-surface-medium">
                      <span>Pendiente de este recibo</span>
                      <span>S/ {currentReceiptUnpaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-on-surface-strong pt-0.5 border-t border-border-light">
                      <span>Total a pagar</span>
                      <span>S/ {totalOwed.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          {ledger && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-700/40 text-[13px]">
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                Saldo del contrato: S/{' '}
                <span className={ledger.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {ledger.balance.toFixed(2)}
                </span>
              </span>
              {ledger.creditRemaining > 0 && (
                <span className="text-blue-600 dark:text-blue-400 ml-2">
                  (crédito: S/ {ledger.creditRemaining.toFixed(2)})
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500.00"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Metodo
              </label>
              <Dropdown
                value={method}
                onChange={(v) => setMethod(v as PaymentMethod)}
                options={(
                  Object.entries(methodLabels) as Array<
                    [PaymentMethod, string]
                  >
                ).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Fecha
            </label>
            <DatePicker value={date} onChange={setDate} required />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Referencia (opcional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° voucher / operación"
              maxLength={128}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Descripcion (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pago mensual enero"
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Registrar Pago'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
