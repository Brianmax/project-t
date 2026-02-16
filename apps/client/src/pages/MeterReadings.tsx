import { useState, useEffect } from 'react';
import { Activity, Droplets, Zap } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface DepartmentMeter {
  id: number;
  meterType: 'light' | 'water';
  departmentId: number;
}

interface MeterReading {
  id: number;
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
      apiFetch<MeterReading[]>('/meter-reading'),
      apiFetch<DepartmentMeter[]>('/department-meter'),
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
      const added = await apiPost<MeterReading>('/meter-reading', {
        reading: Number(value),
        date,
        departmentMeterId: Number(meterId),
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

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm";

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
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {readings.length === 0 ? (
        <EmptyState icon={Activity} title="Sin lecturas" description="Registra lecturas de medidor para hacer seguimiento al consumo." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Medidor</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Valor</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-slate-500">#{r.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {r.departmentMeter?.meterType === 'water' ? (
                        <Droplets size={16} className="text-blue-500" />
                      ) : (
                        <Zap size={16} className="text-amber-500" />
                      )}
                      <span className="text-slate-600">
                        Medidor #{r.departmentMeter?.id || 'N/A'} -{' '}
                        <span className="capitalize">{r.departmentMeter?.meterType === 'water' ? 'Agua' : 'Luz'}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900">{r.reading}</td>
                  <td className="px-5 py-3.5 text-slate-600">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Medidor</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Valor de Lectura</label>
            <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="12345.67" required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors">
            {submitting ? 'Guardando...' : 'Guardar Lectura'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
