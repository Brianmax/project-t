import { useState, useEffect } from 'react';
import { Activity, Droplets, Zap } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { inputCls, btnPrimaryCls } from '../lib/styles';
import DatePicker from '../components/DatePicker';

interface DepartmentMeter {
  id: string;
  meterType: 'light' | 'water';
  departmentId: string;
}

interface MeterReading {
  id: string;
  reading: number;
  date: string;
  departmentMeter: DepartmentMeter;
}

export default function MeterReadings() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [meters, setMeters] = useState<DepartmentMeter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [date, setDate] = useState('');
  const [meterId, setMeterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<MeterReading[]>('/meter-readings'),
      apiFetch<DepartmentMeter[]>('/department-meters'),
    ])
      .then(([r, m]) => {
        setReadings(r);
        setMeters(m);
      })
      .catch(() => setError('No se pudieron cargar las lecturas'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || !date || !meterId) return;
    setSubmitting(true);
    try {
      const added = await apiPost<MeterReading>('/meter-readings', {
        reading: Number(value),
        date,
        departmentMeterId: meterId,
      });
      setReadings((prev) => [...prev, added]);
      setValue('');
      setDate('');
      setMeterId('');
      setModalOpen(false);
    } catch {
      setError('Error al agregar lectura');
    } finally {
      setSubmitting(false);
    }
  };

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
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Medidor</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Valor</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-on-surface-muted">#{r.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {r.departmentMeter?.meterType === 'water' ? (
                        <Droplets size={16} className="text-blue-500" />
                      ) : (
                        <Zap size={16} className="text-amber-500" />
                      )}
                      <span className="text-on-surface-medium">
                        Medidor #{r.departmentMeter?.id || 'N/A'} -{' '}
                        <span className="capitalize">{r.departmentMeter?.meterType === 'water' ? 'Agua' : 'Luz'}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-on-surface">{r.reading}</td>
                  <td className="px-5 py-3.5 text-on-surface-medium">
                    {new Date(r.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Lectura">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Medidor</label>
            <select value={meterId} onChange={(e) => setMeterId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar medidor...</option>
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id} - {m.meterType === 'water' ? 'Agua' : 'Luz'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Valor de Lectura</label>
            <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12345.67" required className={inputCls} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Fecha</label>
            <DatePicker value={date} onChange={setDate} required />
          </div>
          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Guardar Lectura'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
