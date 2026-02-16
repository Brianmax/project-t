import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Trash2,
  Plus,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

// ── Types ──────────────────────────────────────────────

interface Property {
  id: number;
  name: string;
  address: string;
}

interface Department {
  id: number;
  name: string;
  property?: Property;
}

interface Contract {
  id: number;
  startDate: string;
  endDate: string;
  rentAmount: number;
  departmentId: number;
  tenant: { id: number; name: string };
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
  id: number;
  description: string;
  amount: number;
  month: number;
  year: number;
  contractId: number;
}

interface ReceiptItem {
  description: string;
  amount: number;
}

interface GeneratedReceipt {
  id?: number;
  contractId: number;
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
  const departmentId = Number(id);
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
  const [receiptLoading, setReceiptLoading] = useState(false);
  const receiptStatusLabel: Record<GeneratedReceipt['status'], string> = {
    pending_review: 'Pendiente de revisión',
    approved: 'Aprobado',
    denied: 'Denegado',
  };
  const receiptStatusClass: Record<GeneratedReceipt['status'], string> = {
    pending_review: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    denied: 'bg-red-100 text-red-700',
  };

  // ── Fetch data ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [dept, contracts, cons] = await Promise.all([
        apiFetch<Department>(`/department/${departmentId}`),
        apiFetch<Contract[]>('/contract'),
        apiFetch<ConsumptionData>(`/consumption/department/${departmentId}`),
      ]);

      setDepartment(dept);
      setConsumption(cons);

      // Find active contract for this department (same logic as DepartmentDashboard)
      const activeContract = contracts.find(
        (c) => c.departmentId === departmentId,
      ) ?? null;
      setContract(activeContract);

      // Fetch extra charges if contract exists
      if (activeContract) {
        const charges = await apiFetch<ExtraCharge[]>(
          `/extra-charge?contractId=${activeContract.id}&month=${month}&year=${year}`,
        );
        setExtraCharges(charges);
      } else {
        setExtraCharges([]);
      }
    } catch {
      setError('No se pudieron cargar los datos de facturación');
    } finally {
      setLoading(false);
    }
  }, [departmentId, month, year]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // ── Refresh extra charges only ────────────────────────

  const refreshCharges = useCallback(async () => {
    if (!contract) return;
    try {
      const charges = await apiFetch<ExtraCharge[]>(
        `/extra-charge?contractId=${contract.id}&month=${month}&year=${year}`,
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
      await apiPost('/extra-charge', {
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
      await apiFetch(`/extra-charge/${chargeId}`, { method: 'DELETE' });
      await refreshCharges();
    } catch {
      setError('Error al eliminar cargo extra');
    }
  };

  const handleGenerateReceipt = useCallback(async () => {
    if (!contract) return;
    setReceiptLoading(true);
    try {
      let data: GeneratedReceipt;
      try {
        data = await apiFetch<GeneratedReceipt>(
          `/contract/${contract.id}/receipt?month=${month}&year=${year}`,
          { method: 'POST' },
        );
      } catch (postError) {
        const message =
          postError instanceof Error ? postError.message : '';
        const shouldFallback =
          message.includes('404') ||
          message.includes('405') ||
          message.includes('500');

        if (!shouldFallback) {
          throw postError;
        }

        data = await apiFetch<GeneratedReceipt>(
          `/contract/${contract.id}/receipt?month=${month}&year=${year}`,
        );
      }

      setReceipt(data);
      setReceiptModal(true);
    } catch (error) {
      const details =
        error instanceof Error ? ` (${error.message})` : '';
      setError(`Error al generar recibo${details}`);
    } finally {
      setReceiptLoading(false);
    }
  }, [contract, month, year]);

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

  const lightHasReadings = consumption?.light.prevReading !== null;
  const waterHasReadings = consumption?.water.prevReading !== null;
  const lightCost = lightHasReadings ? consumption!.light.cost : 0;
  const waterCost = waterHasReadings ? consumption!.water.cost : 0;

  const extraTotal = extraCharges.reduce(
    (sum, ec) => sum + Number(ec.amount),
    0,
  );
  const total = rentAmount + lightCost + waterCost + extraTotal;

  // ── Style helpers ─────────────────────────────────────

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm';
  const btnCls =
    'py-2.5 px-5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors';

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
          to={`/department/${departmentId}`}
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 truncate">
            Facturación — {department.name}
          </h1>
          {department.property && (
            <p className="text-sm text-slate-500 mt-0.5">
              {department.property.name}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
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
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          No hay contrato activo para este departamento.
        </div>
      )}

      {/* Missing readings warning */}
      {contract && (!lightHasReadings || !waterHasReadings) && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          Pendiente de lecturas — algunos servicios no tienen lecturas
          suficientes.
        </div>
      )}

      {/* Billing Summary */}
      {contract && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Resumen de Facturación
          </h2>

          <div className="space-y-2">
            {/* Rent */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Alquiler</span>
              <span className="font-medium text-slate-900">
                S/ {rentAmount.toFixed(2)}
              </span>
            </div>

            {/* Light */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                Luz{' '}
                {lightHasReadings
                  ? `(${consumption!.light.consumption} u)`
                  : ''}
              </span>
              {lightHasReadings ? (
                <span className="font-medium text-slate-900">
                  S/ {lightCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-yellow-600 font-medium">Pendiente</span>
              )}
            </div>

            {/* Water */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                Agua{' '}
                {waterHasReadings
                  ? `(${consumption!.water.consumption} u)`
                  : ''}
              </span>
              {waterHasReadings ? (
                <span className="font-medium text-slate-900">
                  S/ {waterCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-yellow-600 font-medium">Pendiente</span>
              )}
            </div>

            {/* Extra charges */}
            {extraCharges.map((ec) => (
              <div key={ec.id} className="flex justify-between text-sm">
                <span className="text-slate-600">
                  Otros: {ec.description}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">
                    S/ {Number(ec.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDeleteCharge(ec.id)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Separator + Total */}
            <div className="border-t border-slate-200 pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900">S/ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add extra charge */}
      {contract && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary-600" />
            Agregar Cargo Extra
          </h3>
          <form
            onSubmit={handleAddCharge}
            className="flex items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">
                Descripción
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
              <label className="block text-xs text-slate-500 mb-1">
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

      {/* Generate receipt button */}
      {contract && (
        <button
          onClick={handleGenerateReceipt}
          disabled={receiptLoading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <FileText size={16} />
          {receiptLoading ? 'Generando...' : 'Generar Recibo'}
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
            <div className="text-sm font-semibold text-slate-900">
              Periodo: {receipt.period}
            </div>
            <div className="text-sm text-slate-600">
              {receipt.tenantName} — {receipt.departmentName}
            </div>
            <div className="text-sm text-slate-500">
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
                    <span className="text-slate-600">{item.description}</span>
                    <span className="font-medium">
                      S/ {item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total a pagar</span>
                <span className="font-semibold">
                  S/ {receipt.totalDue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Pagos realizados</span>
                <span className="font-medium text-emerald-600">
                  S/ {receipt.totalPayments.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Balance</span>
                <span
                  className={
                    receipt.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }
                >
                  S/ {receipt.balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
