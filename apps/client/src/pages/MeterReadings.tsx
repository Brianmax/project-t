import { useState, useEffect } from 'react';
import { Activity, Droplets, Zap, Pencil } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { inputCls, btnPrimaryCls } from '../lib/styles';
import DatePicker from '../components/DatePicker';

interface Department {
  id: string;
  name: string;
}

interface DepartmentMeter {
  id: string;
  meterType: 'light' | 'water';
  departmentId: string;
}

interface MeterReading {
  id: string;
  reading: number;
  date: string;
  billingMonth: number | null;
  billingYear: number | null;
  departmentMeter: DepartmentMeter;
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function MeterReadings() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [meters, setMeters] = useState<DepartmentMeter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();

  // ── New reading form ──
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [date, setDate] = useState('');
  const [billingMonth, setBillingMonth] = useState(now.getMonth() + 1);
  const [billingYear, setBillingYear] = useState(now.getFullYear());
  const [lightValue, setLightValue] = useState('');
  const [waterValue, setWaterValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Edit reading form ──
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editBillingMonth, setEditBillingMonth] = useState(1);
  const [editBillingYear, setEditBillingYear] = useState(now.getFullYear());
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<MeterReading[]>('/meter-readings'),
      apiFetch<DepartmentMeter[]>('/department-meters'),
      apiFetch<Department[]>('/departments'),
    ])
      .then(([r, m, d]) => {
        setReadings(r);
        setMeters(m);
        setDepartments(d);
      })
      .catch(() => setError('No se pudieron cargar las lecturas'))
      .finally(() => setLoading(false));
  }, []);

  // Meters for the selected department
  const deptMeters = meters.filter((m) => m.departmentId === selectedDeptId);
  const lightMeter = deptMeters.find((m) => m.meterType === 'light');
  const waterMeter = deptMeters.find((m) => m.meterType === 'water');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !selectedDeptId || (!lightValue && !waterValue)) return;
    setSubmitting(true);
    try {
      const toCreate: { reading: number; date: string; departmentMeterId: string; billingMonth: number; billingYear: number }[] = [];
      if (lightMeter && lightValue) {
        toCreate.push({ reading: Number(lightValue), date, departmentMeterId: lightMeter.id, billingMonth, billingYear });
      }
      if (waterMeter && waterValue) {
        toCreate.push({ reading: Number(waterValue), date, departmentMeterId: waterMeter.id, billingMonth, billingYear });
      }
      const added = await Promise.all(toCreate.map((body) => apiPost<MeterReading>('/meter-readings', body)));
      setReadings((prev) => [...prev, ...added]);
      setLightValue('');
      setWaterValue('');
      // date and billing period persist for the next department
    } catch {
      setError('Error al agregar lectura');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: MeterReading) => {
    setEditingReading(r);
    setEditDate(r.date.slice(0, 10));
    setEditValue(String(r.reading));
    setEditBillingMonth(r.billingMonth ?? now.getMonth() + 1);
    setEditBillingYear(r.billingYear ?? now.getFullYear());
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReading) return;
    setEditSubmitting(true);
    try {
      const updated = await apiFetch<MeterReading>(`/meter-readings/${editingReading.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ date: editDate, reading: Number(editValue), billingMonth: editBillingMonth, billingYear: editBillingYear }),
      });
      setReadings((prev) => prev.map((r) => r.id === updated.id ? { ...updated, departmentMeter: r.departmentMeter } : r));
      setEditingReading(null);
    } catch {
      setError('Error al actualizar la lectura');
    } finally {
      setEditSubmitting(false);
    }
  };

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id.slice(0, 8);

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Activity}
        title="Lecturas de Medidor"
        subtitle={`${readings.length} lecturas registradas`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nueva Lectura"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
          {error}
        </div>
      )}

      {readings.length === 0 ? (
        <EmptyState icon={Activity} title="Sin lecturas" description="Registra lecturas de medidor para hacer seguimiento al consumo." />
      ) : (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt/80">
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Departamento</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Tipo</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Valor</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Fecha</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Período</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors">
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    {r.departmentMeter ? deptName(r.departmentMeter.departmentId) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {r.departmentMeter?.meterType === 'water' ? (
                        <Droplets size={16} className="text-blue-500" />
                      ) : (
                        <Zap size={16} className="text-amber-500" />
                      )}
                      <span className="text-on-surface-medium">
                        {r.departmentMeter?.meterType === 'water' ? 'Agua' : 'Luz'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-on-surface">{r.reading}</td>
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    {new Date(r.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    {r.billingMonth != null && r.billingYear != null ? `${r.billingMonth}/${r.billingYear}` : '—'}
                  </td>
                  <td className="w-12 px-3 py-3.5 text-center">
                    <button
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-raised hover:bg-surface-alt text-on-surface-medium hover:text-on-surface-strong transition-colors"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New reading modal ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Lectura">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Departamento</label>
            <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar departamento...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Fecha</label>
            <DatePicker value={date} onChange={setDate} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Mes de Facturación</label>
              <select value={billingMonth} onChange={(e) => setBillingMonth(Number(e.target.value))} required className={inputCls}>
                {MONTHS.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Año de Facturación</label>
              <input type="number" value={billingYear} onChange={(e) => setBillingYear(Number(e.target.value))} required className={inputCls} min={2000} max={2100} />
            </div>
          </div>

          {selectedDeptId && (
            <div className="space-y-3">
              {lightMeter ? (
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" /> Lectura Luz
                  </label>
                  <input type="number" step="0.01" value={lightValue} onChange={(e) => setLightValue(e.target.value)} placeholder="12345.67" className={inputCls} />
                </div>
              ) : (
                <p className="text-[13px] text-on-surface-muted">Este departamento no tiene medidor de luz.</p>
              )}
              {waterMeter ? (
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5 flex items-center gap-1.5">
                    <Droplets size={14} className="text-blue-500" /> Lectura Agua
                  </label>
                  <input type="number" step="0.01" value={waterValue} onChange={(e) => setWaterValue(e.target.value)} placeholder="12345.67" className={inputCls} />
                </div>
              ) : (
                <p className="text-[13px] text-on-surface-muted">Este departamento no tiene medidor de agua.</p>
              )}
            </div>
          )}

          <button type="submit" disabled={submitting || !selectedDeptId || (!lightValue && !waterValue)} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Guardar Lectura'}
          </button>
        </form>
      </Modal>

      {/* ── Edit reading modal ── */}
      <Modal isOpen={!!editingReading} onClose={() => setEditingReading(null)} title="Editar Lectura">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Valor de Lectura</label>
            <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Fecha</label>
            <DatePicker value={editDate} onChange={setEditDate} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Mes de Facturación</label>
              <select value={editBillingMonth} onChange={(e) => setEditBillingMonth(Number(e.target.value))} required className={inputCls}>
                {MONTHS.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Año de Facturación</label>
              <input type="number" value={editBillingYear} onChange={(e) => setEditBillingYear(Number(e.target.value))} required className={inputCls} min={2000} max={2100} />
            </div>
          </div>
          <button type="submit" disabled={editSubmitting} className={btnPrimaryCls}>
            {editSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
