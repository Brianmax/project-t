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
  Pencil,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import { PageSkeleton, TableSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { showSuccess, showError } from '../lib/toast';
import {
  inputCls,
  btnCls,
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../lib/styles';
import DatePicker from '../components/DatePicker';

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

interface MeterReading {
  id: string;
  reading: number;
  date: string;
  billingMonth: number | null;
  billingYear: number | null;
  departmentMeter: DepartmentMeter;
  departmentMeterId: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  documentId: string;
}

interface Contract {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  departmentId: string;
  tenant: Tenant;
}

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

  const [lightValue, setLightValue] = useState('');
  const [waterValue, setWaterValue] = useState('');
  const [readingDate, setReadingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [readingModalOpen, setReadingModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [addMissing, setAddMissing] = useState<{
    type: 'light' | 'water';
    month: number;
    year: number;
  } | null>(null);
  const [addMissingValue, setAddMissingValue] = useState('');
  const [addMissingDate, setAddMissingDate] = useState('');
  const [addMissingSubmitting, setAddMissingSubmitting] = useState(false);

  const fetchData = useCallback(
    () =>
      Promise.all([
        apiFetch<Department>(`/departments/${departmentId}`),
        apiFetch<DepartmentMeter[]>('/department-meters'),
        apiFetch<ConsumptionData>(`/departments/${departmentId}/consumption`),
        apiFetch<Contract[]>('/contracts'),
      ])
        .then(([dept, allMeters, cons, allContracts]) => {
          setDepartment(dept);

          const contract =
            allContracts.find((c) => c.departmentId === departmentId) ?? null;
          setActiveContract(contract);

          const deptMeters = allMeters.filter(
            (m) => m.department?.id === departmentId,
          );
          setMeters(deptMeters);

          setConsumption(cons);
        })
        .catch(() =>
          showError('No se pudieron cargar los datos del departamento'),
        )
        .finally(() => setLoading(false)),
    [departmentId],
  );

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
        .filter((r) =>
          meterIds.has(r.departmentMeterId ?? r.departmentMeter?.id),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      setReadings(deptReadings);
      setHistoryLoaded(true);
    } catch {
      showError('Error al cargar historial de lecturas');
    } finally {
      setHistoryLoading(false);
    }
  }, [meters]);

  useEffect(() => {
    if (historyOpen && !historyLoaded && !historyLoading) {
      void fetchReadingsHistory();
    }
  }, [historyOpen, historyLoaded, historyLoading, fetchReadingsHistory]);

  const lightMeter = meters.find((m) => m.meterType === 'light');
  const waterMeter = meters.find((m) => m.meterType === 'water');

  const lightLastReading = consumption?.light.lastReading ?? null;
  const waterLastReading = consumption?.water.lastReading ?? null;

  const lightError =
    lightValue !== '' &&
    lightLastReading !== null &&
    Number(lightValue) < lightLastReading
      ? `Debe ser mayor a la lectura anterior (${lightLastReading})`
      : null;

  const waterError =
    waterValue !== '' &&
    waterLastReading !== null &&
    Number(waterValue) < waterLastReading
      ? `Debe ser mayor a la lectura anterior (${waterLastReading})`
      : null;

  const submitReadings = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!lightValue && !waterValue) || lightError || waterError) return;
    setSubmitting(true);
    try {
      const posts: Promise<unknown>[] = [];
      if (lightMeter && lightValue) {
        posts.push(
          apiPost('/meter-readings', {
            reading: Number(lightValue),
            date: readingDate,
            departmentMeterId: lightMeter.id,
          }),
        );
      }
      if (waterMeter && waterValue) {
        posts.push(
          apiPost('/meter-readings', {
            reading: Number(waterValue),
            date: readingDate,
            departmentMeterId: waterMeter.id,
          }),
        );
      }
      await Promise.all(posts);
      setLightValue('');
      setWaterValue('');
      setReadingModalOpen(false);
      await fetchData();
      if (historyLoaded) await fetchReadingsHistory();
      showSuccess('Lecturas registradas exitosamente');
    } catch {
      showError('Error al registrar lecturas');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const openEdit = (id: string, value: number, date: string) => {
    setEditingId(id);
    setEditValue(String(value));
    setEditDate(date.slice(0, 10));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditSubmitting(true);
    try {
      await apiFetch(`/meter-readings/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ reading: Number(editValue), date: editDate }),
      });
      setEditingId(null);
      await fetchReadingsHistory();
      await fetchData();
      showSuccess('Lectura actualizada exitosamente');
    } catch {
      showError('Error al actualizar la lectura');
    } finally {
      setEditSubmitting(false);
    }
  };

  const openAddMissing = (
    type: 'light' | 'water',
    month: number,
    year: number,
  ) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    setAddMissingDate(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    );
    setAddMissingValue('');
    setAddMissing({ type, month, year });
  };

  const handleAddMissingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMissing || !addMissingValue) return;
    const meter = addMissing.type === 'light' ? lightMeter : waterMeter;
    if (!meter) return;
    setAddMissingSubmitting(true);
    try {
      await apiPost('/meter-readings', {
        reading: Number(addMissingValue),
        date: addMissingDate,
        departmentMeterId: meter.id,
      });
      setAddMissing(null);
      await fetchReadingsHistory();
      await fetchData();
      showSuccess('Lectura agregada exitosamente');
    } catch {
      showError('Error al agregar lectura');
    } finally {
      setAddMissingSubmitting(false);
    }
  };

  const openReadingModal = () => {
    setLightValue('');
    setWaterValue('');
    setReadingDate(new Date().toISOString().slice(0, 10));
    setReadingModalOpen(true);
  };
  const handleBillingClick = () => {
    navigate(`/departments/${departmentId}/billing`);
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
      label: string;
      light: number | null;
      water: number | null;
      lightDate: string | null;
      waterDate: string | null;
      lightId: string | null;
      waterId: string | null;
    };

    const getBillingMonth = (
      r: MeterReading,
    ): { year: number; month: number } | null => {
      if (r.billingMonth != null && r.billingYear != null) {
        return { year: r.billingYear, month: r.billingMonth - 1 };
      }
      const rawDate = String(r.date ?? '');
      const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return null;
      let y = Number(match[1]);
      let m = Number(match[2]) - 1;
      const day = Number(match[3]);
      if (day === 1) {
        m -= 1;
        if (m < 0) {
          m = 11;
          y -= 1;
        }
      }
      return { year: y, month: m };
    };

    const grouped = new Map<string, Row>();

    for (const r of readings) {
      const bm = getBillingMonth(r);
      if (!bm) continue;
      const meterType =
        r.departmentMeter?.meterType ?? meterTypeById.get(r.departmentMeterId);
      if (!meterType) continue;

      const rawDate = String(r.date ?? '');
      const dateKey = rawDate.slice(0, 10);
      const billingKey = `${bm.year}-${bm.month}`;
      const rowKey = `${billingKey}__${dateKey}`;

      if (!grouped.has(rowKey)) {
        grouped.set(rowKey, {
          key: rowKey,
          year: bm.year,
          month: bm.month,
          label: `${monthNames[bm.month]} ${bm.year} (${dateKey})`,
          light: null,
          water: null,
          lightDate: null,
          waterDate: null,
          lightId: null,
          waterId: null,
        });
      }

      const row = grouped.get(rowKey)!;
      if (meterType === 'light') {
        row.light = Number(r.reading);
        row.lightDate = rawDate;
        row.lightId = r.id;
      } else if (meterType === 'water') {
        row.water = Number(r.reading);
        row.waterDate = rawDate;
        row.waterId = r.id;
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month || b.key.localeCompare(a.key),
    );
  }, [readings, meterTypeById]);

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
            to="/properties"
            className="text-primary-600 hover:underline text-sm"
          >
            Volver a Propiedades
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Link
          to={
            department.property
              ? `/properties/${department.property.id}`
              : '/departments'
          }
          className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-on-surface-medium hover:bg-surface-raised hover:text-on-surface-strong transition-all duration-150 flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-on-surface tracking-tight truncate">
            {department.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-on-surface-muted mt-0.5">
            <div className="flex items-center gap-1.5">
              <Layers size={14} />
              Piso {department.floor}
            </div>
            <div className="flex items-center gap-1.5">
              <BedDouble size={14} />
              {department.numberOfRooms} hab.
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${department.isAvailable ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-700/40' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-200/50 dark:ring-red-700/40'}`}
            >
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

      {activeContract?.tenant && (
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-on-surface-strong mb-3">
            Inquilino
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-200/50 dark:ring-emerald-700/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg flex-shrink-0">
              {activeContract.tenant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                to={`/tenants/${activeContract.tenant.id}`}
                className="font-semibold text-on-surface hover:text-primary-600 hover:underline"
              >
                {activeContract.tenant.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[13px] text-on-surface-muted">
                {activeContract.tenant.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={13} className="text-on-surface-faint" />
                    {activeContract.tenant.email}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Phone size={13} className="text-on-surface-faint" />
                  {activeContract.tenant.phone}
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-on-surface-faint" />
                  {formatDate(activeContract.startDate)} —{' '}
                  {formatDate(activeContract.endDate)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-on-surface-strong">
          Consumo Actual
        </h2>
        {(lightMeter || waterMeter) && (
          <button
            type="button"
            onClick={openReadingModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-raised text-on-surface-medium hover:text-on-surface-strong transition-all duration-150"
          >
            <Plus size={14} />
            Nueva Lectura
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-100 dark:ring-amber-800/40 flex items-center justify-center">
              <Zap size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold text-on-surface">Luz</h3>
          </div>
          {consumption && consumption.light.prevReading !== null ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">
                  Consumo
                </span>
                <span className="font-medium text-on-surface">
                  {consumption.light.consumption} u
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Costo</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  S/ {consumption.light.cost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">
                  Ultima lectura
                </span>
                <span className="font-medium text-on-surface">
                  {consumption.light.lastReading}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-faint">
              Sin lecturas suficientes
            </p>
          )}
        </div>

        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-100 dark:ring-blue-800/40 flex items-center justify-center">
              <Droplets
                size={18}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 className="font-semibold text-on-surface">Agua</h3>
          </div>
          {consumption && consumption.water.prevReading !== null ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">
                  Consumo
                </span>
                <span className="font-medium text-on-surface">
                  {consumption.water.consumption} u
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">Costo</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  S/ {consumption.water.cost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-on-surface-muted">
                  Ultima lectura
                </span>
                <span className="font-medium text-on-surface">
                  {consumption.water.lastReading}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-faint">
              Sin lecturas suficientes
            </p>
          )}
        </div>
      </div>

      {!lightMeter && !waterMeter && (
        <div className="mb-8">
          <EmptyState
            icon={DoorOpen}
            title="Sin medidores"
            description="Este departamento no tiene medidores asignados."
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-on-surface-strong">
          Historial de Lecturas
        </h2>
        <button
          type="button"
          onClick={() => setHistoryOpen((prev) => !prev)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-raised text-on-surface-medium hover:bg-surface-raised transition-all duration-150"
        >
          {historyOpen ? 'Ocultar historial' : 'Ver historial'}
        </button>
      </div>
      {historyOpen &&
        (historyLoading ? (
          <div className="mb-8">
            <TableSkeleton rows={6} cols={3} />
          </div>
        ) : monthlyReadings.length === 0 ? (
          <div className="mb-8">
            <EmptyState
              icon={DoorOpen}
              title="Sin lecturas"
              description="No hay lecturas registradas para este departamento."
            />
          </div>
        ) : (
          <div className={`mb-8 ${tableContainerCls}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderCls}>
                  <th className={tableHeaderCellCls}>Mes</th>
                  <th className="text-right px-4 md:px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider whitespace-nowrap">
                    Luz
                  </th>
                  <th className="text-right px-4 md:px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider whitespace-nowrap">
                    Agua
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyReadings.map((row) => (
                  <tr key={row.key} className={tableRowCls}>
                    <td className={`${tableCellCls} text-on-surface-medium`}>
                      {row.label}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {row.light !== null ? (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="font-semibold text-on-surface">
                            {row.light}
                          </span>
                          <button
                            onClick={() =>
                              openEdit(row.lightId!, row.light!, row.lightDate!)
                            }
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-raised hover:bg-surface-alt text-on-surface-medium hover:text-on-surface-strong transition-colors"
                            title="Editar lectura de luz"
                          >
                            <Pencil size={11} />
                          </button>
                        </span>
                      ) : lightMeter ? (
                        <button
                          onClick={() =>
                            openAddMissing('light', row.month, row.year)
                          }
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-raised hover:bg-surface-alt text-on-surface-medium hover:text-on-surface-strong transition-colors"
                          title="Agregar lectura de luz"
                        >
                          <Plus size={11} />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {row.water !== null ? (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="font-semibold text-on-surface">
                            {row.water}
                          </span>
                          <button
                            onClick={() =>
                              openEdit(row.waterId!, row.water!, row.waterDate!)
                            }
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-raised hover:bg-surface-alt text-on-surface-medium hover:text-on-surface-strong transition-colors"
                            title="Editar lectura de agua"
                          >
                            <Pencil size={11} />
                          </button>
                        </span>
                      ) : waterMeter ? (
                        <button
                          onClick={() =>
                            openAddMissing('water', row.month, row.year)
                          }
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-raised hover:bg-surface-alt text-on-surface-medium hover:text-on-surface-strong transition-colors"
                          title="Agregar lectura de agua"
                        >
                          <Plus size={11} />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <Modal
        isOpen={readingModalOpen}
        onClose={() => setReadingModalOpen(false)}
        title="Registrar Lecturas"
      >
        <form onSubmit={submitReadings} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Fecha
            </label>
            <DatePicker
              value={readingDate}
              onChange={setReadingDate}
              required
            />
          </div>

          {lightMeter && (
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500" /> Luz
                {lightLastReading !== null && (
                  <span className="font-normal text-on-surface-muted">
                    — anterior: {lightLastReading}
                  </span>
                )}
              </label>
              <input
                type="number"
                step="any"
                value={lightValue}
                onChange={(e) => setLightValue(e.target.value)}
                placeholder="Nueva lectura"
                className={inputCls}
              />
              {lightError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {lightError}
                </p>
              )}
            </div>
          )}

          {waterMeter && (
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5 flex items-center gap-1.5">
                <Droplets size={13} className="text-blue-500" /> Agua
                {waterLastReading !== null && (
                  <span className="font-normal text-on-surface-muted">
                    — anterior: {waterLastReading}
                  </span>
                )}
              </label>
              <input
                type="number"
                step="any"
                value={waterValue}
                onChange={(e) => setWaterValue(e.target.value)}
                placeholder="Nueva lectura"
                className={inputCls}
              />
              {waterError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {waterError}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              !!lightError ||
              !!waterError ||
              (!lightValue && !waterValue)
            }
            className={btnCls}
          >
            {submitting ? 'Guardando...' : 'Registrar Lecturas'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={!!addMissing}
        onClose={() => setAddMissing(null)}
        title={
          addMissing?.type === 'light'
            ? 'Agregar Lectura de Luz'
            : 'Agregar Lectura de Agua'
        }
      >
        <form onSubmit={handleAddMissingSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-[13px] text-on-surface-muted">
            {addMissing?.type === 'light' ? (
              <>
                <Zap size={13} className="text-amber-500" /> Lectura anterior:{' '}
                {lightLastReading ?? 'N/A'}
              </>
            ) : (
              <>
                <Droplets size={13} className="text-blue-500" /> Lectura
                anterior: {waterLastReading ?? 'N/A'}
              </>
            )}
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Valor
            </label>
            <input
              type="number"
              step="any"
              value={addMissingValue}
              onChange={(e) => setAddMissingValue(e.target.value)}
              placeholder="Nueva lectura"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Fecha
            </label>
            <DatePicker
              value={addMissingDate}
              onChange={setAddMissingDate}
              required
            />
          </div>
          <button
            type="submit"
            disabled={addMissingSubmitting || !addMissingValue}
            className={btnCls}
          >
            {addMissingSubmitting ? 'Guardando...' : 'Guardar Lectura'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
        title="Editar Lectura"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Valor
            </label>
            <input
              type="number"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Fecha
            </label>
            <DatePicker value={editDate} onChange={setEditDate} required />
          </div>
          <button type="submit" disabled={editSubmitting} className={btnCls}>
            {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
