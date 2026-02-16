import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Building2, Layers, BedDouble } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Property {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  floor: number;
  numberOfRooms: number;
  property: Property;
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [floor, setFloor] = useState('');
  const [rooms, setRooms] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Department[]>('/department'),
      apiFetch<Property[]>('/property'),
    ])
      .then(([d, p]) => {
        setDepartments(d);
        setProperties(p);
      })
      .catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !floor || !rooms || !propertyId) return;
    setSubmitting(true);
    try {
      const added = await apiPost<Department>('/department', {
        name,
        floor: Number(floor),
        numberOfRooms: Number(rooms),
        propertyId: Number(propertyId),
      });
      setDepartments((prev) => [...prev, added]);
      setName('');
      setFloor('');
      setRooms('');
      setPropertyId('');
      setModalOpen(false);
    } catch {
      setError('Error al agregar departamento');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={DoorOpen}
        title="Departamentos"
        subtitle={`${departments.length} departamentos registrados`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Departamento"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {departments.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="Sin departamentos"
          description="Agrega departamentos a tus propiedades para comenzar."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <DoorOpen size={20} className="text-violet-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">
                    <Link to={`/department/${d.id}`} className="hover:text-primary-600 hover:underline">{d.name}</Link>
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Building2 size={14} />
                    <span>{d.property?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Layers size={14} className="text-slate-400" />
                  Piso {d.floor}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <BedDouble size={14} className="text-slate-400" />
                  {d.numberOfRooms} hab.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Departamento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Depto 101"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Piso</label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="1"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Habitaciones</label>
              <input
                type="number"
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                placeholder="2"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Propiedad</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            >
              <option value="">Seleccionar propiedad...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {submitting ? 'Guardando...' : 'Guardar Departamento'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
