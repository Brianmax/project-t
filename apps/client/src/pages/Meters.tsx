import { useState, useEffect } from 'react';
import { Gauge, Droplets, Zap } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Department { id: number; name: string; }
interface Property { id: number; name: string; }

interface DepartmentMeter {
  id: number;
  meterType: 'light' | 'water';
  department: Department;
}

interface PropertyMeter {
  id: number;
  meterType: 'light' | 'water';
  property: Property;
}

type Tab = 'department' | 'property';

export default function Meters() {
  const [tab, setTab] = useState<Tab>('department');
  const [deptMeters, setDeptMeters] = useState<DepartmentMeter[]>([]);
  const [propMeters, setPropMeters] = useState<PropertyMeter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [meterType, setMeterType] = useState<'light' | 'water'>('light');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<DepartmentMeter[]>('/department-meter'),
      apiFetch<PropertyMeter[]>('/property-meter'),
      apiFetch<Department[]>('/department'),
      apiFetch<Property[]>('/property'),
    ])
      .then(([dm, pm, d, p]) => {
        setDeptMeters(dm);
        setPropMeters(pm);
        setDepartments(d);
        setProperties(p);
      })
      .catch(() => setError('No se pudieron cargar los medidores'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      if (tab === 'department') {
        const added = await apiPost<DepartmentMeter>('/department-meter', {
          meterType,
          departmentId: Number(selectedId),
        });
        setDeptMeters((prev) => [...prev, added]);
      } else {
        const added = await apiPost<PropertyMeter>('/property-meter', {
          meterType,
          propertyId: Number(selectedId),
        });
        setPropMeters((prev) => [...prev, added]);
      }
      setSelectedId('');
      setModalOpen(false);
    } catch {
      setError('Error al agregar medidor');
    } finally {
      setSubmitting(false);
    }
  };

  const MeterIcon = ({ type }: { type: string }) =>
    type === 'water' ? (
      <Droplets size={16} className="text-blue-500" />
    ) : (
      <Zap size={16} className="text-amber-500" />
    );

  if (loading) return <Spinner />;

  const meters = tab === 'department' ? deptMeters : propMeters;
  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm";

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Gauge}
        title="Medidores"
        subtitle={`${deptMeters.length + propMeters.length} medidores en total`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Medidor"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
        <button
          onClick={() => setTab('department')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Departamento ({deptMeters.length})
        </button>
        <button
          onClick={() => setTab('property')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'property' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Propiedad ({propMeters.length})
        </button>
      </div>

      {meters.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Sin medidores"
          description={`No hay medidores de ${tab === 'department' ? 'departamento' : 'propiedad'} registrados.`}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">
                  {tab === 'department' ? 'Departamento' : 'Propiedad'}
                </th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-slate-500">#{m.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <MeterIcon type={m.meterType} />
                      <span className="capitalize font-medium text-slate-900">{m.meterType === 'water' ? 'Agua' : 'Luz'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {tab === 'department'
                      ? (m as DepartmentMeter).department?.name || 'N/A'
                      : (m as PropertyMeter).property?.name || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Nuevo Medidor (${tab === 'department' ? 'Departamento' : 'Propiedad'})`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-2">
            <button
              type="button"
              onClick={() => { setTab('department'); setSelectedId(''); }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Departamento
            </button>
            <button
              type="button"
              onClick={() => { setTab('property'); setSelectedId(''); }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'property' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Propiedad
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Medidor</label>
            <select value={meterType} onChange={(e) => setMeterType(e.target.value as 'light' | 'water')} className={inputCls}>
              <option value="light">Luz</option>
              <option value="water">Agua</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {tab === 'department' ? 'Departamento' : 'Propiedad'}
            </label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar...</option>
              {(tab === 'department' ? departments : properties).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors">
            {submitting ? 'Guardando...' : 'Agregar Medidor'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
