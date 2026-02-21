import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Trash2,
  Plus,
  FileText,
  AlertTriangle,
  Check,
  X as XIcon,
  Send,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { inputCls, btnCls } from '../lib/styles';

// ── Types ──────────────────────────────────────────────

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Department {
  id: string;
  name: string;
  property?: Property;
}

interface Contract {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  departmentId: string;
  tenant: { id: string; name: string };
  department: Department;
}

interface ConsumptionData {
  light: {
    consumption: number;
    cost: number;
    lastReading: number | null;
    prevReading: number | null;
  };
  water: {
    consumption: number;
    cost: number;
    lastReading: number | null;
    prevReading: number | null;
  };
}

interface ExtraCharge {
  id: string;
  description: string;
  amount: number;
  month: number;
  year: number;
  contractId: string;
}

interface ReceiptItem {
  description: string;
  amount: number;
}

interface GeneratedReceipt {
  id?: string;
  contractId: string;
  month: number;
  year: number;
  status: 'pending_review' | 'approved' | 'denied';
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  period: string;
  items: ReceiptItem[];
  totalPayments: number;
  totalDue: number;
  balance: number;
}

// ── Component ──────────────────────────────────────────

export default function DepartmentBilling() {
  const { id } = useParams<{ id: string }>();
  const departmentId = id!;
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldAutoGenerate = searchParams.get('autogenerate') === '1';
  const autoGenerateTriggeredRef = useRef(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [department, setDepartment] = useState<Department | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionData | null>(null);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add extra charge form
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Receipt modal
  const [receiptModal, setReceiptModal] = useState(false);
  const [receipt, setReceipt] = useState<GeneratedReceipt | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<GeneratedReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [approvingReceipt, setApprovingReceipt] = useState(false);
  const receiptStatusLabel: Record<GeneratedReceipt['status'], string> = {
    pending_review: 'Pendiente de revision',
    approved: 'Aprobado',
    denied: 'Denegado',
  };
  const receiptStatusClass: Record<GeneratedReceipt['status'], string> = {
    pending_review: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-700/40',
    approved: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-700/40',
    denied: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-200/50 dark:ring-red-700/40',
  };

  // ── Fetch data ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setReceipt(null);
    setPreviewReceipt(null);

    try {
      const [dept, contracts, cons] = await Promise.all([
        apiFetch<Department>(`/departments/${departmentId}`),
        apiFetch<Contract[]>(`/contracts?departmentId=${departmentId}`),
        apiFetch<ConsumptionData>(`/departments/${departmentId}/consumption`),
      ]);

      setDepartment(dept);
      setConsumption(cons);

      const activeContract = contracts[0] ?? null;
      setContract(activeContract);

      if (activeContract) {
        const charges = await apiFetch<ExtraCharge[]>(
          `/extra-charges?contractId=${activeContract.id}&month=${month}&year=${year}`,
        );
        setExtraCharges(charges);

        // Load preview/saved receipt for the selected period
        try {
          const fetchedReceipt = await apiFetch<GeneratedReceipt>(
            `/contracts/${activeContract.id}/receipts?month=${month}&year=${year}`,
          );
          setPreviewReceipt(fetchedReceipt);
          if (fetchedReceipt.id) {
            setReceipt(fetchedReceipt);
          }
        } catch {
          // No receipt data available for this period
        }
      } else {
        setExtraCharges([]);
      }
    } catch {
      setError('No se pudieron cargar los datos de facturacion');
    } finally {
      setLoading(false);
    }
  }, [departmentId, month, year]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Clear receipt state when month or year changes
  useEffect(() => {
    setReceipt(null);
    setPreviewReceipt(null);
  }, [month, year]);

  // ── Refresh extra charges only ────────────────────────

  const refreshCharges = useCallback(async () => {
    if (!contract) return;
    try {
      const charges = await apiFetch<ExtraCharge[]>(
        `/extra-charges?contractId=${contract.id}&month=${month}&year=${year}`,
      );
      setExtraCharges(charges);
    } catch {
      setError('Error al cargar cargos extra');
    }
  }, [contract, month, year]);

  // ── Handlers ──────────────────────────────────────────

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeDesc || !chargeAmount || !contract) return;
    setSubmitting(true);
    try {
      await apiPost('/extra-charges', {
        description: chargeDesc,
        amount: Number(chargeAmount),
        month,
        year,
        contractId: contract.id,
      });
      setChargeDesc('');
      setChargeAmount('');
      await refreshCharges();
    } catch {
      setError('Error al agregar cargo extra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCharge = async (chargeId: number) => {
    try {
      await apiFetch(`/extra-charges/${chargeId}`, { method: 'DELETE' });
      await refreshCharges();
    } catch {
      setError('Error al eliminar cargo extra');
    }
  };

  const handleGenerateReceipt = useCallback(async () => {
    if (!contract) return;
    setReceiptLoading(true);
    try {
      const data = await apiFetch<GeneratedReceipt>(
        `/contracts/${contract.id}/receipts?month=${month}&year=${year}`,
        { method: 'POST' },
      );
      setReceipt(data);
      setPreviewReceipt(data);
      setReceiptModal(true);
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : '';
      setError(`Error al generar recibo${details}`);
    } finally {
      setReceiptLoading(false);
    }
  }, [contract, month, year]);

  const handleApproveReceipt = async () => {
    if (!contract || !receipt) return;
    setApprovingReceipt(true);
    try {
      const updated = await apiFetch<GeneratedReceipt>(
        `/contracts/${contract.id}/receipts/status?month=${month}&year=${year}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        },
      );
      setReceipt(updated);
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : '';
      setError(`Error al aprobar recibo${details}`);
    } finally {
      setApprovingReceipt(false);
    }
  };

  const handleDenyReceipt = async () => {
    if (!contract || !receipt) return;
    setApprovingReceipt(true);
    try {
      const updated = await apiFetch<GeneratedReceipt>(
        `/contracts/${contract.id}/receipts/status?month=${month}&year=${year}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'denied' }),
        },
      );
      setReceipt(updated);
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : '';
      setError(`Error al denegar recibo${details}`);
    } finally {
      setApprovingReceipt(false);
    }
  };

  const handleSendWhatsApp = () => {
    // TODO: Implement WhatsApp sending via Twilio + BullMQ
    alert('WhatsApp sending will be implemented in next phase');
  };

  useEffect(() => {
    if (!shouldAutoGenerate || !contract || receiptLoading) return;
    if (autoGenerateTriggeredRef.current) return;
    autoGenerateTriggeredRef.current = true;
    void handleGenerateReceipt().finally(() => {
      const next = new URLSearchParams(searchParams);
      next.delete('autogenerate');
      setSearchParams(next, { replace: true });
    });
  }, [
    shouldAutoGenerate,
    contract,
    receiptLoading,
    searchParams,
    setSearchParams,
    handleGenerateReceipt,
  ]);

  // ── Computed ──────────────────────────────────────────

  const rentAmount = contract ? Number(contract.rentAmount) : 0;

  // Use period-specific data from the receipt preview/saved receipt when available.
  // Fall back to current consumption only when no preview has loaded yet.
  const displaySource = receipt ?? previewReceipt;

  let lightCost = 0;
  let waterCost = 0;
  let lightHasReadings = false;
  let waterHasReadings = false;

  if (displaySource) {
    const lightItem = displaySource.items.find((item) =>
      item.description.toLowerCase().includes('electricity') ||
      item.description.toLowerCase().includes('luz'),
    );
    const waterItem = displaySource.items.find((item) =>
      item.description.toLowerCase().includes('water') ||
      item.description.toLowerCase().includes('agua'),
    );
    lightCost = lightItem ? lightItem.amount : 0;
    waterCost = waterItem ? waterItem.amount : 0;
    lightHasReadings = lightCost > 0;
    waterHasReadings = waterCost > 0;
  } else {
    lightHasReadings = consumption !== null && consumption.light.prevReading !== null;
    waterHasReadings = consumption !== null && consumption.water.prevReading !== null;
    lightCost = lightHasReadings ? consumption!.light.cost : 0;
    waterCost = waterHasReadings ? consumption!.water.cost : 0;
  }

  // Units to display next to each service label
  const lightUnits = displaySource
    ? null  // units embedded in receipt description; don't duplicate
    : (lightHasReadings ? consumption!.light.consumption : null);
  const waterUnits = displaySource
    ? null
    : (waterHasReadings ? consumption!.water.consumption : null);

  const extraTotal = extraCharges.reduce(
    (sum, ec) => sum + Number(ec.amount),
    0,
  );
  const total = rentAmount + lightCost + waterCost + extraTotal;

  // ── Style helpers ─────────────────────────────────────

  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  // ── Render ────────────────────────────────────────────

  if (loading) return <Spinner />;

  if (!department) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon={DoorOpen}
          title="Departamento no encontrado"
          description="El departamento solicitado no existe."
        />
        <div className="text-center mt-4">
          <Link
            to="/departments"
            className="text-primary-600 hover:underline text-sm"
          >
            Volver a Departamentos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/departments/${departmentId}`}
          className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-on-surface-medium hover:bg-surface-raised hover:text-on-surface-strong transition-all duration-150 flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-on-surface tracking-tight truncate">
            Facturacion — {department.name}
          </h1>
          {department.property && (
            <p className="text-[13px] text-on-surface-muted mt-0.5">
              {department.property.name}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className={inputCls + ' max-w-[180px]'}
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={inputCls + ' max-w-[100px]'}
        />
      </div>

      {/* No contract warning */}
      {!contract && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          No hay contrato activo para este departamento.
        </div>
      )}

      {/* Missing readings warning */}
      {contract && (!lightHasReadings || !waterHasReadings) && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          Pendiente de lecturas — algunos servicios no tienen lecturas
          suficientes.
        </div>
      )}

      {/* Billing Summary */}
      {contract && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-on-surface-strong mb-4">
            Resumen de Facturacion
          </h2>

          <div className="space-y-2">
            {/* Rent */}
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">Alquiler</span>
              <span className="font-medium text-on-surface">
                S/ {rentAmount.toFixed(2)}
              </span>
            </div>

            {/* Light */}
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">
                Luz{' '}
                {lightUnits !== null ? `(${lightUnits} u)` : ''}
              </span>
              {lightHasReadings ? (
                <span className="font-medium text-on-surface">
                  S/ {lightCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Pendiente</span>
              )}
            </div>

            {/* Water */}
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">
                Agua{' '}
                {waterUnits !== null ? `(${waterUnits} u)` : ''}
              </span>
              {waterHasReadings ? (
                <span className="font-medium text-on-surface">
                  S/ {waterCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Pendiente</span>
              )}
            </div>

            {/* Extra charges */}
            {extraCharges.map((ec) => (
              <div key={ec.id} className="flex justify-between text-sm">
                <span className="text-on-surface-medium">
                  Otros: {ec.description}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-on-surface">
                    S/ {Number(ec.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDeleteCharge(ec.id)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Separator + Total */}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-on-surface">Total</span>
                <span className="text-on-surface">S/ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add extra charge */}
      {contract && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary-600" />
            Agregar Cargo Extra
          </h3>
          <form
            onSubmit={handleAddCharge}
            className="flex items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Descripcion
              </label>
              <input
                type="text"
                value={chargeDesc}
                onChange={(e) => setChargeDesc(e.target.value)}
                placeholder="TV Cable, Limpieza, etc."
                required
                className={inputCls}
              />
            </div>
            <div className="w-32">
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Monto (S/)
              </label>
              <input
                type="number"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="50.00"
                required
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={submitting} className={btnCls}>
              {submitting ? 'Guardando...' : 'Agregar'}
            </button>
          </form>
        </div>
      )}

      {/* Receipt status indicator */}
      {contract && receipt && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
          <FileText size={16} />
          <div>
            <span className="font-semibold">Recibo existente para {months[month - 1]} {year}</span>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Estado: {receiptStatusLabel[receipt.status]} • Total: S/ {receipt.totalDue.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Generate receipt button */}
      {contract && (
        <button
          onClick={handleGenerateReceipt}
          disabled={receiptLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm shadow-blue-600/20 transition-all duration-150 flex items-center justify-center gap-2"
        >
          <FileText size={16} />
          {receiptLoading ? 'Generando...' : receipt ? 'Regenerar Recibo' : 'Generar Recibo'}
        </button>
      )}

      {/* Receipt Modal */}
      <Modal
        isOpen={receiptModal}
        onClose={() => setReceiptModal(false)}
        title={`Recibo — ${months[month - 1]} ${year}`}
      >
        {receipt && (
          <div className="space-y-3 animate-fade-in">
            <div className="text-sm font-semibold text-on-surface">
              Periodo: {receipt.period}
            </div>
            <div className="text-[13px] text-on-surface-medium">
              {receipt.tenantName} — {receipt.departmentName}
            </div>
            <div className="text-[13px] text-on-surface-muted">
              {receipt.propertyAddress}
            </div>
            <div>
              <span
                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${receiptStatusClass[receipt.status]}`}
              >
                {receiptStatusLabel[receipt.status]}
              </span>
            </div>

            {receipt.items.length > 0 && (
              <div className="space-y-1 pt-2">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-on-surface-medium">{item.description}</span>
                    <span className="font-medium">
                      S/ {item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-surface-alt rounded-xl ring-1 ring-border-ring p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-medium">Total a pagar</span>
                <span className="font-semibold">
                  S/ {receipt.totalDue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-medium">Pagos realizados</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  S/ {receipt.totalPayments.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Balance</span>
                <span
                  className={
                    receipt.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }
                >
                  S/ {receipt.balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {receipt.status === 'pending_review' && (
                <>
                  <button
                    onClick={handleApproveReceipt}
                    disabled={approvingReceipt}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    {approvingReceipt ? 'Aprobando...' : 'Aprobar'}
                  </button>
                  <button
                    onClick={handleDenyReceipt}
                    disabled={approvingReceipt}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
                  >
                    <XIcon size={16} />
                    {approvingReceipt ? 'Procesando...' : 'Denegar'}
                  </button>
                </>
              )}

              {receipt.status === 'approved' && (
                <button
                  onClick={handleSendWhatsApp}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  Enviar por WhatsApp
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
