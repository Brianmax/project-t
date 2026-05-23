import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Trash2,
  Plus,
  FileText,
  AlertTriangle,
  Check,
  Send,
  Ban,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import { PageSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { showSuccess, showError } from '../lib/toast';
import { inputCls, btnCls } from '../lib/styles';

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
  advancePayment: number;
  guaranteeDeposit: number;
  departmentId: string;
  status: 'active' | 'terminated';
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
  type: 'manual' | 'late_fee';
  sourceReceiptId: string | null;
  ratePerDay: number | null;
  daysOverdue: number | null;
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
  status: 'unpaid' | 'paid';
  paidAt: string | null;
  paidBy: string | null;
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  period: string;
  items: ReceiptItem[];
  totalPayments: number;
  totalDue: number;
  balance: number;
}

interface TerminationResult {
  id: string;
  contractId: string;
  tenantName: string;
  departmentName: string;
  expectedDepartureDate: string;
  actualDepartureDate: string;
  apartmentCondition: string | null;
  advanceApplied: number;
  guaranteeDeposit: number;
  guaranteeDeduction: number;
  servicesCost: number;
  guaranteeReturn: number;
  rentRefund: number;
  createdAt: string;
}

export default function DepartmentBilling() {
  const { id } = useParams<{ id: string }>();
  const departmentId = id!;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [department, setDepartment] = useState<Department | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionData | null>(null);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDeparture, setShowDeparture] = useState(false);
  const [departureDay, setDepartureDay] = useState('');
  const [lastReadingDate, setLastReadingDate] = useState<string | null>(null);
  const [receiptMonths, setReceiptMonths] = useState<
    Array<{ month: number; year: number }>
  >([]);
  const [baselineMonth, setBaselineMonth] = useState<{
    month: number;
    year: number;
  } | null>(null);

  const [apartmentCondition, setApartmentCondition] = useState('');
  const [termination, setTermination] = useState<TerminationResult | null>(
    null,
  );
  const [terminationLoading, setTerminationLoading] = useState(false);

  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [receiptModal, setReceiptModal] = useState(false);
  const [receipt, setReceipt] = useState<GeneratedReceipt | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<GeneratedReceipt | null>(
    null,
  );
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const receiptStatusLabel: Record<GeneratedReceipt['status'], string> = {
    unpaid: 'No pagado',
    paid: 'Pagado',
  };
  const receiptStatusClass: Record<GeneratedReceipt['status'], string> = {
    unpaid:
      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-700/40',
    paid: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-700/40',
  };

  const getContractStartDayForPeriod = useCallback(
    (selectedContract: Contract | null) => {
      if (!selectedContract) return null;
      const startDate = new Date(
        `${selectedContract.startDate.slice(0, 10)}T12:00:00`,
      );
      if (
        startDate.getFullYear() === year &&
        startDate.getMonth() + 1 === month &&
        startDate.getDate() > 1
      ) {
        return startDate.getDate();
      }
      return null;
    },
    [month, year],
  );

  const buildBillingParams = useCallback(
    (selectedContract: Contract | null) => {
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      });
      const startDay = getContractStartDayForPeriod(selectedContract);
      if (departureDay) {
        params.set('startDay', String(startDay ?? 1));
        params.set('endDay', departureDay);
        params.set('prorateRent', 'true');
      } else if (startDay) {
        params.set('startDay', String(startDay));
      }
      return params;
    },
    [departureDay, getContractStartDayForPeriod, month, year],
  );

  const fetchData = useCallback(async () => {
    setReceipt(null);
    setPreviewReceipt(null);

    try {
      const [dept, contracts, latestReading, earliestBilling] =
        await Promise.all([
          apiFetch<Department>(`/departments/${departmentId}`),
          apiFetch<Contract[]>(`/contracts?departmentId=${departmentId}`),
          apiFetch<{ date: string | null }>(
            `/departments/${departmentId}/meter-readings/latest`,
          ).catch(() => ({ date: null })),
          apiFetch<{ month: number; year: number } | null>(
            `/departments/${departmentId}/meter-readings/earliest-billing-period`,
          ).catch(() => null),
        ]);

      setDepartment(dept);
      setLastReadingDate(latestReading?.date ?? null);
      setBaselineMonth(earliestBilling ?? null);

      const today = new Date().toISOString().slice(0, 10);
      const activeContract =
        contracts
          .filter(
            (c) =>
              c.status === 'active' &&
              c.endDate.slice(0, 10) >= today &&
              c.tenant,
          )
          .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
      setContract(activeContract);

      const periodParams = buildBillingParams(activeContract);
      const cons = await apiFetch<{
        light: { consumption: number; cost: number };
        water: { consumption: number; cost: number };
      }>(
        `/departments/${departmentId}/consumption/period?${periodParams}`,
      ).catch(() => null);

      setConsumption(
        cons
          ? {
              light: {
                consumption: cons.light.consumption,
                cost: cons.light.cost,
                lastReading: null,
                prevReading: cons.light.consumption > 0 ? 0 : null,
              },
              water: {
                consumption: cons.water.consumption,
                cost: cons.water.cost,
                lastReading: null,
                prevReading: cons.water.consumption > 0 ? 0 : null,
              },
            }
          : null,
      );

      if (activeContract) {
        const [charges, existingTermination, months] = await Promise.all([
          apiFetch<ExtraCharge[]>(
            `/extra-charges?contractId=${activeContract.id}&month=${month}&year=${year}`,
          ),
          apiFetch<TerminationResult | null>(
            `/contracts/${activeContract.id}/termination`,
          ).catch(() => null),
          apiFetch<Array<{ month: number; year: number; status: string }>>(
            `/contracts/${activeContract.id}/receipts/months`,
          ).catch(() => []),
        ]);
        setExtraCharges(charges);
        setReceiptMonths(months.map(({ month: m, year: y }) => ({ month: m, year: y })));

        if (existingTermination) {
          setTermination(existingTermination);
          setShowDeparture(true);
        } else {
          setTermination(null);
          if (!departureDay) {
            setShowDeparture(false);
          }
        }

        try {
          const previewParams = buildBillingParams(activeContract);
          const fetchedReceipt = await apiFetch<GeneratedReceipt>(
            `/contracts/${activeContract.id}/receipts?${previewParams}`,
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
        setTermination(null);
        setShowDeparture(false);
      }
    } catch {
      showError('No se pudieron cargar los datos de facturacion');
    } finally {
      setLoading(false);
    }
  }, [buildBillingParams, departmentId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setReceipt(null);
    setPreviewReceipt(null);
    if (!termination) {
      setShowDeparture(false);
      setDepartureDay('');
    }
  }, [month, year, termination]);

  const refreshCharges = useCallback(async () => {
    if (!contract) return;
    try {
      const [charges, updatedPreview] = await Promise.all([
        apiFetch<ExtraCharge[]>(
          `/extra-charges?contractId=${contract.id}&month=${month}&year=${year}`,
        ),
        apiFetch<GeneratedReceipt>(
          `/contracts/${contract.id}/receipts?month=${month}&year=${year}`,
        ).catch(() => null),
      ]);
      setExtraCharges(charges);
      if (updatedPreview) {
        setPreviewReceipt(updatedPreview);
        if (updatedPreview.id) {
          setReceipt(updatedPreview);
        }
      }
    } catch {
      showError('Error al cargar cargos extra');
    }
  }, [contract, month, year]);

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
      showSuccess('Cargo extra agregado exitosamente');
    } catch {
      showError('Error al agregar cargo extra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCharge = async (chargeId: string) => {
    try {
      await apiFetch(`/extra-charges/${chargeId}`, { method: 'DELETE' });
      await refreshCharges();
      showSuccess('Cargo extra eliminado exitosamente');
    } catch (err) {
      const details = err instanceof Error ? ` (${err.message})` : '';
      showError(`Error al eliminar cargo extra${details}`);
    }
  };

  const handleGenerateReceipt = useCallback(async () => {
    if (!contract) return;
    setReceiptLoading(true);
    try {
      const params = buildBillingParams(contract);
      const data = await apiFetch<GeneratedReceipt>(
        `/contracts/${contract.id}/receipts?${params}`,
        { method: 'POST' },
      );
      setReceipt(data);
      setPreviewReceipt(data);
      setReceiptModal(true);
      showSuccess('Recibo generado exitosamente');
      setReceiptMonths((prev) =>
        prev.some((p) => p.month === data.month && p.year === data.year)
          ? prev
          : [...prev, { month: data.month, year: data.year }],
      );
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : '';
      showError(`Error al generar recibo${details}`);
    } finally {
      setReceiptLoading(false);
    }
  }, [buildBillingParams, contract]);

  const handleMarkAsPaid = async () => {
    if (!contract || !receipt) return;
    setMarkingPaid(true);
    try {
      const updated = await apiFetch<GeneratedReceipt>(
        `/contracts/${contract.id}/receipts/status?month=${month}&year=${year}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'paid' }),
        },
      );
      setReceipt(updated);
      showSuccess('Recibo marcado como pagado');
    } catch (error) {
      const details = error instanceof Error ? ` (${error.message})` : '';
      showError(`Error al marcar como pagado${details}`);
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleSendWhatsApp = () => {
    alert('WhatsApp sending will be implemented in next phase');
  };

  const handleTerminate = async () => {
    if (!contract || !departureDay) return;
    setTerminationLoading(true);
    try {
      const result = await apiFetch<TerminationResult>(
        `/contracts/${contract.id}/termination`,
        {
          method: 'POST',
          body: JSON.stringify({
            actualDepartureDate,
            apartmentCondition: apartmentCondition || undefined,
            guaranteeDeduction: 0,
            servicesCost: lightCost + waterCost + extraTotal,
            proratedRentAmount: rentAmount,
          }),
        },
      );
      setTermination(result);
      setContract((prev) => (prev ? { ...prev, status: 'terminated' } : prev));
      showSuccess('Contrato cerrado exitosamente');
    } catch (err) {
      const details = err instanceof Error ? ` (${err.message})` : '';
      showError(`Error al cerrar contrato${details}`);
    } finally {
      setTerminationLoading(false);
    }
  };

  const handleCancelDeparture = () => {
    setShowDeparture(false);
    setDepartureDay('');
    setApartmentCondition('');
  };

  const isTerminated =
    contract?.status === 'terminated' || termination !== null;

  const fullRent = contract ? Number(contract.rentAmount) : 0;
  const rentAmount = (() => {
    if (!contract) return 0;
    if (showDeparture && departureDay) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const daysOccupied = Number(departureDay);
      return (daysOccupied / daysInMonth) * fullRent;
    }
    return fullRent;
  })();

  const displaySource = receipt ?? previewReceipt;

  let lightCost = 0;
  let waterCost = 0;
  let lightHasReadings = false;
  let waterHasReadings = false;

  if (consumption) {
    lightCost = consumption.light.cost;
    waterCost = consumption.water.cost;
    lightHasReadings = consumption.light.consumption > 0;
    waterHasReadings = consumption.water.consumption > 0;
  } else if (displaySource) {
    const lightItem = displaySource.items.find(
      (item) =>
        item.description.toLowerCase().includes('electricity') ||
        item.description.toLowerCase().includes('luz'),
    );
    const waterItem = displaySource.items.find(
      (item) =>
        item.description.toLowerCase().includes('water') ||
        item.description.toLowerCase().includes('agua'),
    );
    lightCost = lightItem ? lightItem.amount : 0;
    waterCost = waterItem ? waterItem.amount : 0;
    lightHasReadings = lightCost > 0;
    waterHasReadings = waterCost > 0;
  }

  const lightUnits =
    lightHasReadings && consumption ? consumption.light.consumption : null;
  const waterUnits =
    waterHasReadings && consumption ? consumption.water.consumption : null;

  const extraTotal = extraCharges.reduce(
    (sum, ec) => sum + Number(ec.amount),
    0,
  );
  const total = rentAmount + lightCost + waterCost + extraTotal;

  const guaranteeDepositAmt = contract ? Number(contract.guaranteeDeposit) : 0;
  const advanceAmt = contract ? Number(contract.advancePayment) : 0;
  const creditsTotal = advanceAmt + guaranteeDepositAmt;

  const actualDepartureDate = departureDay
    ? `${year}-${String(month).padStart(2, '0')}-${String(Number(departureDay)).padStart(2, '0')}`
    : contract
      ? contract.endDate.slice(0, 10)
      : '';

  const monthAbbr = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];

  const missingReceiptMonths: Array<{ month: number; year: number }> = (() => {
    if (!contract) return [];
    const start = new Date(contract.startDate);
    let m = start.getMonth() + 1;
    let y = start.getFullYear();
    const seq: Array<{ month: number; year: number }> = [];
    while (y < year || (y === year && m <= month)) {
      seq.push({ month: m, year: y });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    const have = new Set(receiptMonths.map((r) => `${r.year}-${r.month}`));
    const baselineKey = baselineMonth
      ? `${baselineMonth.year}-${baselineMonth.month}`
      : null;
    return seq.filter(
      (p) =>
        !have.has(`${p.year}-${p.month}`) &&
        `${p.year}-${p.month}` !== baselineKey,
    );
  })();

  const manualExtrasTotal = extraCharges
    .filter((ec) => ec.type !== 'late_fee')
    .reduce((s, ec) => s + Number(ec.amount), 0);
  const lateFeeTotal = extraCharges
    .filter((ec) => ec.type === 'late_fee')
    .reduce((s, ec) => s + Number(ec.amount), 0);
  const balanceSummary = creditsTotal - total;

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

  if (loading) return <PageSkeleton />;

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

      {isTerminated && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-700/40 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <Ban size={16} />
          <span className="font-semibold">Contrato terminado.</span>
          <span className="text-red-600 dark:text-red-400">
            No se pueden generar nuevos recibos.
          </span>
        </div>
      )}

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

      {contract && !showDeparture && !isTerminated && (
        <button
          onClick={() => {
            setShowDeparture(true);
            if (lastReadingDate) {
              const d = new Date(lastReadingDate + 'T12:00:00');
              if (
                d.getFullYear() === year &&
                d.getMonth() + 1 === month
              ) {
                setDepartureDay(String(d.getDate()));
              }
            }
          }}
          className="flex items-center gap-2 text-[13px] font-medium text-on-surface-medium hover:text-on-surface transition-colors mb-6"
        >
          <DoorOpen size={15} />
          Indicar salida anticipada
        </button>
      )}

      {contract && showDeparture && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-6 space-y-4">
          {!termination && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-[13px] font-medium text-on-surface-medium whitespace-nowrap">
                Dia de salida
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={departureDay}
                onChange={(e) => setDepartureDay(e.target.value)}
                placeholder="ej. 15"
                className={inputCls + ' max-w-[100px]'}
              />
              <span className="text-[12px] text-on-surface-muted">
                Alquiler se cobra solo por días ocupados.
              </span>
              <button
                onClick={handleCancelDeparture}
                className="text-[13px] text-on-surface-faint hover:text-on-surface-medium transition-colors ml-auto"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="border-t border-border pt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted mb-3">
              Cierre de contrato
            </p>

            {termination ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-200/50 dark:ring-red-700/40">
                    <Ban size={11} />
                    Contrato cerrado
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                  <span className="text-on-surface-medium">
                    Fecha esperada de salida
                  </span>
                  <span className="text-on-surface font-medium">
                    {new Date(
                      termination.expectedDepartureDate,
                    ).toLocaleDateString('es-PE')}
                  </span>
                  <span className="text-on-surface-medium">
                    Fecha real de salida
                  </span>
                  <span className="text-on-surface font-medium">
                    {new Date(
                      termination.actualDepartureDate,
                    ).toLocaleDateString('es-PE')}
                  </span>
                  {termination.apartmentCondition && (
                    <>
                      <span className="text-on-surface-medium">
                        Condicion del apartamento
                      </span>
                      <span className="text-on-surface font-medium">
                        {termination.apartmentCondition}
                      </span>
                    </>
                  )}
                  <span className="text-on-surface-medium">
                    Adelanto aplicado
                  </span>
                  <span className="text-on-surface font-medium">
                    S/ {Number(termination.advanceApplied).toFixed(2)} → cubre
                    ultimo mes
                  </span>
                  <span className="text-on-surface-medium">
                    Deposito de garantia
                  </span>
                  <span className="text-on-surface font-medium">
                    S/ {Number(termination.guaranteeDeposit).toFixed(2)}
                  </span>
                  <span className="text-on-surface-medium">Deduccion</span>
                  <span className="text-on-surface font-medium">
                    S/ {Number(termination.guaranteeDeduction).toFixed(2)}
                  </span>
                  {Number(termination.servicesCost) > 0 && (
                    <>
                      <span className="text-on-surface-medium">
                        Servicios del mes
                      </span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        − S/ {Number(termination.servicesCost).toFixed(2)}
                      </span>
                    </>
                  )}
                  <span className="text-on-surface-medium font-semibold">
                    A devolver (garantia)
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    S/ {Number(termination.guaranteeReturn).toFixed(2)}
                  </span>
                  {Number(termination.rentRefund) > 0 && (
                    <>
                      <span className="text-on-surface-medium font-semibold">
                        Devolucion alquiler
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        S/ {Number(termination.rentRefund).toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <span className="text-[13px] font-medium text-on-surface-medium">
                    Fecha real de salida
                  </span>
                  <span className="text-[14px] font-semibold text-on-surface">
                    {departureDay
                      ? new Date(
                          actualDepartureDate + 'T12:00:00',
                        ).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '— (ingresa Día de salida)'}
                  </span>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                    Condicion del apartamento
                  </label>
                  <textarea
                    value={apartmentCondition}
                    onChange={(e) => setApartmentCondition(e.target.value)}
                    placeholder="Descripcion del estado del apartamento..."
                    rows={2}
                    className={inputCls + ' resize-none'}
                  />
                </div>

                <p className="text-[12px] text-on-surface-muted">
                  Las reparaciones o daños se registran como cargos extras
                  arriba — se descontarán automáticamente de los créditos.
                </p>

                <button
                  onClick={handleTerminate}
                  disabled={
                    !departureDay ||
                    missingReceiptMonths.length > 0 ||
                    terminationLoading
                  }
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Ban size={15} />
                  {terminationLoading
                    ? 'Procesando...'
                    : 'Confirmar cierre de contrato'}
                </button>
                {missingReceiptMonths.length > 0 && (
                  <p className="text-[12px] text-red-600 dark:text-red-400">
                    Faltan recibos:{' '}
                    {missingReceiptMonths
                      .map((p) => `${monthAbbr[p.month - 1]} ${p.year}`)
                      .join(', ')}
                    . Genera los recibos pendientes antes de cerrar el contrato.
                  </p>
                )}
              </div>
            )}
            </div>

            {!termination && (
              <div className="lg:col-span-2 space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
                    Créditos disponibles
                  </p>
                  <div className="space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Adelanto</span>
                      <span className="font-medium text-on-surface">
                        S/ {advanceAmt.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Garantía</span>
                      <span className="font-medium text-on-surface">
                        S/ {guaranteeDepositAmt.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200/60 dark:border-emerald-800/40 pt-1.5 mt-1.5 font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Total créditos
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        S/ {creditsTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200/60 dark:border-red-800/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300 mb-2">
                    Total facturado del mes
                  </p>
                  <div className="space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">
                        Alquiler{departureDay ? ' (prorr.)' : ''}
                      </span>
                      <span className="font-medium text-on-surface">
                        S/ {rentAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Luz</span>
                      <span className="font-medium text-on-surface">
                        S/ {lightCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Agua</span>
                      <span className="font-medium text-on-surface">
                        S/ {waterCost.toFixed(2)}
                      </span>
                    </div>
                    {manualExtrasTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-medium">
                          Extras / reparaciones
                        </span>
                        <span className="font-medium text-on-surface">
                          S/ {manualExtrasTotal.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {lateFeeTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-on-surface-medium">Mora</span>
                        <span className="font-medium text-on-surface">
                          S/ {lateFeeTotal.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-red-200/60 dark:border-red-800/40 pt-1.5 mt-1.5 font-semibold">
                      <span className="text-red-700 dark:text-red-300">
                        Total facturado
                      </span>
                      <span className="text-red-700 dark:text-red-300">
                        S/ {total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-alt rounded-xl border border-border p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-muted mb-2">
                    Resumen
                  </p>
                  <div className="space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Créditos</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        + S/ {creditsTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-medium">Facturado</span>
                      <span className="font-medium text-red-600 dark:text-red-400">
                        − S/ {total.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 mt-1">
                      {balanceSummary > 0 ? (
                        <div className="flex justify-between font-bold">
                          <span className="text-on-surface">
                            A devolver al inquilino
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            S/ {balanceSummary.toFixed(2)}
                          </span>
                        </div>
                      ) : balanceSummary < 0 ? (
                        <div className="flex justify-between font-bold">
                          <span className="text-on-surface">
                            Saldo a cobrar al inquilino
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            S/ {Math.abs(balanceSummary).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between font-bold">
                          <span className="text-on-surface">Balance</span>
                          <span className="text-on-surface">S/ 0.00</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!contract && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          No hay contrato activo para este departamento.
        </div>
      )}

      {contract && (!lightHasReadings || !waterHasReadings) && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          Pendiente de lecturas — algunos servicios no tienen lecturas
          suficientes.
        </div>
      )}

      {contract && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-on-surface-strong mb-4">
            Resumen de Facturacion
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">Alquiler</span>
              <span className="font-medium text-on-surface">
                S/ {rentAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">
                Luz {lightUnits !== null ? `(${lightUnits} u)` : ''}
              </span>
              {lightHasReadings ? (
                <span className="font-medium text-on-surface">
                  S/ {lightCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Pendiente
                </span>
              )}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-on-surface-medium">
                Agua {waterUnits !== null ? `(${waterUnits} u)` : ''}
              </span>
              {waterHasReadings ? (
                <span className="font-medium text-on-surface">
                  S/ {waterCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Pendiente
                </span>
              )}
            </div>

            {extraCharges.map((ec) => (
              <div key={ec.id} className="flex justify-between text-sm">
                <span className="text-on-surface-medium flex items-center gap-1.5">
                  Otros: {ec.description}
                  {ec.type === 'late_fee' && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-700/40">
                      MORA
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-on-surface">
                    S/ {Number(ec.amount).toFixed(2)}
                  </span>
                  {ec.type !== 'late_fee' && (
                    <button
                      onClick={() => handleDeleteCharge(ec.id)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-on-surface">Total</span>
                <span className="text-on-surface">S/ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {contract && !isTerminated && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary-600" />
            {showDeparture
              ? 'Agregar Cargo Extra o Reparación'
              : 'Agregar Cargo Extra'}
          </h3>
          <form
            onSubmit={handleAddCharge}
            className="flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                Descripcion
              </label>
              <input
                type="text"
                value={chargeDesc}
                onChange={(e) => setChargeDesc(e.target.value)}
                placeholder={
                  showDeparture
                    ? 'TV Cable, Limpieza, Reparación de lavabo, Pintura, etc.'
                    : 'TV Cable, Limpieza, etc.'
                }
                required
                className={inputCls}
              />
            </div>
            <div className="w-full sm:w-32">
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

      {contract && receipt && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-700/40 text-blue-700 dark:text-blue-300 text-sm flex items-center gap-2">
          <FileText size={16} />
          <div>
            <span className="font-semibold">
              Recibo existente para {months[month - 1]} {year}
            </span>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Estado: {receiptStatusLabel[receipt.status]} • Total: S/{' '}
              {receipt.totalDue.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {contract && !isTerminated && (
        <button
          onClick={handleGenerateReceipt}
          disabled={receiptLoading || receipt?.status === 'paid'}
          title={
            receipt?.status === 'paid'
              ? 'Recibo pagado — no se puede regenerar'
              : undefined
          }
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm shadow-blue-600/20 transition-all duration-150 flex items-center justify-center gap-2"
        >
          <FileText size={16} />
          {receiptLoading
            ? 'Generando...'
            : receipt
              ? 'Regenerar Recibo'
              : 'Generar Recibo'}
        </button>
      )}

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
              {receipt.status === 'paid' && receipt.paidAt && (
                <p className="text-[11px] text-on-surface-muted mt-1.5">
                  Pagado el{' '}
                  {new Date(receipt.paidAt).toLocaleDateString('es-PE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {receipt.paidBy ? ` por ${receipt.paidBy.slice(0, 8)}` : ''}
                </p>
              )}
            </div>

            {receipt.items.length > 0 && (
              <div className="space-y-1 pt-2">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-on-surface-medium">
                      {item.description}
                    </span>
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
                    receipt.balance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  S/ {receipt.balance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {receipt.status === 'unpaid' && (
                <button
                  onClick={handleMarkAsPaid}
                  disabled={markingPaid}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-surface-raised disabled:text-on-surface-faint text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  {markingPaid ? 'Marcando...' : 'Marcar como pagado'}
                </button>
              )}

              <button
                onClick={handleSendWhatsApp}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
