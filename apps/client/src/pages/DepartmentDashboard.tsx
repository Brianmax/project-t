import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DoorOpen,
  Layers,
  BedDouble,
  Zap,
  Droplets,
  Calendar,
  Plus,
  Receipt,
  Mail,
  Phone,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { inputCls, btnCls } from '../lib/styles';
import DatePicker from '../components/DatePicker';

// ── Types ──────────────────────────────────────────────

interface Property {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  floor: number;
  numberOfRooms: number;
  isAvailable: boolean;
  property?: Property;
}

interface DepartmentMeter {
  id: string;
  meterType: 'light' | 'water';
  department: Department;
}

interface ConsumptionData {
  light: { consumption: number; cost: number; lastReading: number | null; prevReading: number | null };
  water: { consumption: number; cost: number; lastReading: number | null; prevReading: number | null };
}

interface MeterReading {
  id: string;
  reading: number;
  date: string;
  departmentMeter: DepartmentMeter;
  departmentMeterId: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Contract {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  departmentId: string;
  tenant: Tenant;
}

// ── Component ──────────────────────────────────────────

export default function DepartmentDashboard() {
  const { id } = useParams<{ id: string }>();
  const departmentId = id!;
  const navigate = useNavigate();

  const [department, setDepartment] = useState<Department | null>(null);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [meters, setMeters] = useState<DepartmentMeter[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionData | null>(null);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reading form state
  const [lightValue, setLightValue] = useState('');
  const [lightDate, setLightDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [waterValue, setWaterValue] = useState('');
  const [waterDate, setWaterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [readingModalType, setReadingModalType] = useState<'light' | 'water' | null>(null);


  // ── Fetch data ────────────────────────────────────────

  const fetchData = useCallback(() =>
    Promise.all([
      apiFetch<Department>(`/departments/${departmentId}`),
      apiFetch<DepartmentMeter[]>('/department-meters'),
      apiFetch<ConsumptionData>(`/departments/${departmentId}/consumption`),
      apiFetch<Contract[]>('/contracts'),
    ])
      .then(([dept, allMeters, cons, allContracts]) => {
        setDepartment(dept);

        // Find active contract for this department
        const contract = allContracts.find((c) => c.departmentId === departmentId) ?? null;
        setActiveContract(contract);

        const deptMeters = allMeters.filter((m) => m.department?.id === departmentId);
        setMeters(deptMeters);

        setConsumption(cons);
      })
      .catch(() => setError('No se pudieron cargar los datos del departamento'))
      .finally(() => setLoading(false)),
    [departmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setReadings([]);
    setHistoryOpen(false);
    setHistoryLoaded(false);
    setHistoryLoading(false);
  }, [departmentId]);

  const fetchReadingsHistory = useCallback(async () => {
    if (meters.length === 0) {
      setReadings([]);
      setHistoryLoaded(true);
      return;
    }
    setHistoryLoading(true);
    try {
      const allReadings = await apiFetch<MeterReading[]>('/meter-readings');
      const meterIds = new Set(meters.map((m) => m.id));
      const deptReadings = allReadings
        .filter((r) => meterIds.has(r.departmentMeterId ?? r.departmentMeter?.id))
        .sort((a, b) => b.date.localeCompare(a.date));
      setReadings(deptReadings);
      setHistoryLoaded(true);
    } catch {
      setError('Error al cargar historial de lecturas');
    } finally {
      setHistoryLoading(false);
    }
  }, [meters]);

  useEffect(() => {
    if (historyOpen && !historyLoaded && !historyLoading) {
      void fetchReadingsHistory();
    }
  }, [historyOpen, historyLoaded, historyLoading, fetchReadingsHistory]);

  // ── Validation ────────────────────────────────────────

  const lightMeter = meters.find((m) => m.meterType === 'light');
  const waterMeter = meters.find((m) => m.meterType === 'water');

  const lightLastReading = consumption?.light.lastReading ?? null;
  const waterLastReading = consumption?.water.lastReading ?? null;

  const lightError =
    lightValue !== '' && lightLastReading !== null && Number(lightValue) < lightLastReading
      ? `La lectura no puede ser menor a la anterior (${lightLastReading})`
      : null;

  const waterError =
    waterValue !== '' && waterLastReading !== null && Number(waterValue) < waterLastReading
      ? `La lectura no puede ser menor a la anterior (${waterLastReading})`
      : null;

  // ── Submit handlers ───────────────────────────────────

  const submitLightReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lightValue || !lightDate || !lightMeter || lightError) return;
    setSubmitting(true);
    try {
      await apiPost('/meter-readings', {
        reading: Number(lightValue),
        date: lightDate,
        departmentMeterId: lightMeter.id,
      });
      setLightValue('');
      setReadingModalType(null);
      await fetchData();
      if (historyLoaded) {
        await fetchReadingsHistory();
      }
    } catch {
      setError('Error al registrar lectura de luz');
    } finally {
      setSubmitting(false);
    }
  };

  const submitWaterReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waterValue || !waterDate || !waterMeter || waterError) return;
    setSubmitting(true);
    try {
      await apiPost('/meter-readings', {
        reading: Number(waterValue),
        date: waterDate,
        departmentMeterId: waterMeter.id,
      });
      setWaterValue('');
      setReadingModalType(null);
      await fetchData();
      if (historyLoaded) {
        await fetchReadingsHistory();
      }
    } catch {
      setError('Error al registrar lectura de agua');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

  const openReadingModal = (type: 'light' | 'water') => {
    setError(null);
    if (type === 'light') {
      setLightValue('');
      setLightDate(new Date().toISOString().slice(0, 10));
    } else {
      setWaterValue('');
      setWaterDate(new Date().toISOString().slice(0, 10));
    }
    setReadingModalType(type);
  };
  const handleBillingClick = () => {
    navigate(`/departments/${departmentId}/billing?autogenerate=1`);
  };
  const meterTypeById = useMemo(
    () => new Map(meters.map((m) => [m.id, m.meterType])),
    [meters],
  );
  const monthNames = [
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
  const monthlyReadings = useMemo(() => {
    type Row = {
      key: string;
      year: number;
      month: number;
      light: number | null;
      water: number | null;
      lightDate: string | null;
      waterDate: string | null;
    };
    const rows = new Map<string, Row>();
    for (const reading of readings) {
      const rawDate = String(reading.date ?? '');
      const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) {
        continue;
      }
      let year = Number(match[1]);
      let month = Number(match[2]) - 1; // 0-11
      const day = Number(match[3]);

      // Business rule:
      // - Reading on day 1 belongs to previous month.
      // - Any other day belongs to the same month.
      if (day === 1) {
        month -= 1;
        if (month < 0) {
          month = 11;
          year -= 1;
        }
      }

      const key = `${year}-${month}`;
      const meterType =
        reading.departmentMeter?.meterType ?? meterTypeById.get(reading.departmentMeterId);
      if (!meterType) {
        continue;
      }

      const row = rows.get(key) ?? {
        key,
        year,
        month,
        light: null,
        water: null,
        lightDate: null,
        waterDate: null,
      };

      if (meterType === 'light') {
        if (!row.lightDate || rawDate > row.lightDate) {
          row.light = Number(reading.reading);
          row.lightDate = rawDate;
        }
      } else if (meterType === 'water') {
        if (!row.waterDate || rawDate > row.waterDate) {
          row.water = Number(reading.reading);
          row.waterDate = rawDate;
        }
      }

      rows.set(key, row);
    }

    return Array.from(rows.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month,
    );
  }, [readings, meterTypeById]);

  // ── Render ────────────────────────────────────────────

  if (loading) return <Spinner />;

  if (!department) {
    return (
      <div className="animate-fade-in">
        <EmptyState icon={DoorOpen} title="Departamento no encontrado" description="El departamento solicitado no existe." />
        <div className="text-center mt-4">
          <Link to="/properties" className="text-primary-600 hover:underline text-sm">Volver a Propiedades</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={department.property ? `/properties/${department.property.id}` : '/departments'}
          className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-on-surface-medium hover:bg-surface-raised hover:text-on-surface-strong transition-all duration-150 flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-on-surface tracking-tight truncate">{department.name}</h1>
          <div className="flex items-center gap-4 text-[13px] text-on-surface-muted mt-0.5">
            <div className="flex items-center gap-1.5">
              <Layers size={14} />
              Piso {department.floor}
            </div>
            <div className="flex items-center gap-1.5">
              <BedDouble size={14} />
              {department.numberOfRooms} hab.
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${department.isAvailable ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-700/40' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200/50 dark:ring-red-700/40'}`}>
              {department.isAvailable ? 'Disponible' : 'Ocupado'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleBillingClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 ring-1 ring-blue-200/50 dark:ring-blue-700/40 transition-all duration-150 flex-shrink-0"
        >
          <Receipt size={16} />
          Facturacion
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Tenant Card */}
      {activeContract?.tenant && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-on-surface-strong mb-3">Inquilino</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-200/50 dark:ring-emerald-700/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg flex-shrink-0">
              {activeContract.tenant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/tenants/${activeContract.tenant.id}`} className="font-semibold text-on-surface hover:text-primary-600 hover:underline">
                {activeContract.tenant.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[13px] text-on-surface-muted">
                <div className="flex items-center gap-1.5">
                  <Mail size={13} className="text-on-surface-faint" />
                  {activeContract.tenant.email}
                </div>
                {activeContract.tenant.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} className="text-on-surface-faint" />
                    {activeContract.tenant.phone}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-on-surface-faint" />
                  {formatDate(activeContract.startDate)} — {formatDate(activeContract.endDate)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consumption Cards */}
      <h2 className="text-lg font-semibold text-on-surface-strong mb-3">Consumo Actual</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Light */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-100 dark:ring-amber-800/40 flex items-center justify-center">
                <Zap size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-on-surface">Luz</h3>
            </div>
            <button
              type="button"
              onClick={() => openReadingModal('light')}
              disabled={!lightMeter}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:bg-surface-raised disabled:text-on-surface-faint disabled:cursor-not-allowed transition-all duration-150"
              title={lightMeter ? 'Agregar lectura de luz' : 'No hay medidor de luz'}
            >
              <Plus size={14} />
              Lectura
            </button>
          </div>
          {consumption && consumption.light.prevReading !== null ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Consumo</span>
                <span className="font-medium text-on-surface">{consumption.light.consumption} u</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Costo</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">S/ {consumption.light.cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Ultima lectura</span>
                <span className="font-medium text-on-surface">{consumption.light.lastReading}</span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-faint">Sin lecturas suficientes</p>
          )}
        </div>

        {/* Water */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-100 dark:ring-blue-800/40 flex items-center justify-center">
                <Droplets size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-on-surface">Agua</h3>
            </div>
            <button
              type="button"
              onClick={() => openReadingModal('water')}
              disabled={!waterMeter}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:bg-surface-raised disabled:text-on-surface-faint disabled:cursor-not-allowed transition-all duration-150"
              title={waterMeter ? 'Agregar lectura de agua' : 'No hay medidor de agua'}
            >
              <Plus size={14} />
              Lectura
            </button>
          </div>
          {consumption && consumption.water.prevReading !== null ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Consumo</span>
                <span className="font-medium text-on-surface">{consumption.water.consumption} u</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Costo</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">S/ {consumption.water.cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Ultima lectura</span>
                <span className="font-medium text-on-surface">{consumption.water.lastReading}</span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-faint">Sin lecturas suficientes</p>
          )}
        </div>
      </div>

      {!lightMeter && !waterMeter && (
        <div className="mb-8">
          <EmptyState icon={DoorOpen} title="Sin medidores" description="Este departamento no tiene medidores asignados." />
        </div>
      )}

      {/* Reading History */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-on-surface-strong">Historial de Lecturas</h2>
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-raised text-on-surface-medium hover:bg-surface-raised transition-all duration-150"
        >
          {historyOpen ? 'Ocultar historial' : 'Ver historial'}
        </button>
      </div>
      {historyOpen && (
        historyLoading ? (
          <div className="mb-8">
            <Spinner />
          </div>
        ) : monthlyReadings.length === 0 ? (
          <div className="mb-8">
            <EmptyState icon={DoorOpen} title="Sin lecturas" description="No hay lecturas registradas para este departamento." />
          </div>
        ) : (
          <div className="mb-8 bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light bg-surface-alt/80">
                  <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Mes</th>
                  <th className="text-right px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Luz</th>
                  <th className="text-right px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Agua</th>
                </tr>
              </thead>
              <tbody>
                {monthlyReadings.map((row) => (
                  <tr key={row.key} className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors">
                    <td className="px-5 py-3.5 text-on-surface-medium">
                      {monthNames[row.month]} {row.year}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-on-surface">
                      {row.light !== null ? row.light : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-on-surface">
                      {row.water !== null ? row.water : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Modal
        isOpen={readingModalType !== null}
        onClose={() => setReadingModalType(null)}
        title={readingModalType === 'water' ? 'Nueva Lectura de Agua' : 'Nueva Lectura de Luz'}
      >
        {readingModalType === 'light' ? (
          <form onSubmit={submitLightReading} className="space-y-3">
            <p className="text-[13px] text-on-surface-muted">
              Lectura anterior: {lightLastReading !== null ? lightLastReading : 'N/A'}
            </p>
            <div>
              <input
                type="number"
                step="any"
                value={lightValue}
                onChange={(e) => setLightValue(e.target.value)}
                placeholder="Nueva lectura"
                required
                className={inputCls}
              />
              {lightError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{lightError}</p>
              )}
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                <Calendar size={12} className="inline mr-1" />
                Fecha
              </label>
              <DatePicker value={lightDate} onChange={setLightDate} required />
            </div>
            <button type="submit" disabled={submitting || !!lightError || !lightValue} className={btnCls}>
              {submitting ? 'Guardando...' : 'Registrar Lectura'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitWaterReading} className="space-y-3">
            <p className="text-[13px] text-on-surface-muted">
              Lectura anterior: {waterLastReading !== null ? waterLastReading : 'N/A'}
            </p>
            <div>
              <input
                type="number"
                step="any"
                value={waterValue}
                onChange={(e) => setWaterValue(e.target.value)}
                placeholder="Nueva lectura"
                required
                className={inputCls}
              />
              {waterError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{waterError}</p>
              )}
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
                <Calendar size={12} className="inline mr-1" />
                Fecha
              </label>
              <DatePicker value={waterDate} onChange={setWaterDate} required />
            </div>
            <button type="submit" disabled={submitting || !!waterError || !waterValue} className={btnCls}>
              {submitting ? 'Guardando...' : 'Registrar Lectura'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
