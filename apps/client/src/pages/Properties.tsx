import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, MapPin, Trash2 } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Property {
  id: number;
  name: string;
  address: string;
}

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lightCostPerUnit, setLightCostPerUnit] = useState('0.25');
  const [waterCostPerUnit, setWaterCostPerUnit] = useState('0.15');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiFetch<Property[]>('/property')
      .then(setProperties)
      .catch(() => setError('No se pudieron cargar las propiedades'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    setSubmitting(true);
    try {
      const added = await apiPost<Property>('/property', {
        name,
        address,
        lightCostPerUnit: Number(lightCostPerUnit),
        waterCostPerUnit: Number(waterCostPerUnit),
      });
      setProperties((prev) => [...prev, added]);
      setName('');
      setAddress('');
      setLightCostPerUnit('0.25');
      setWaterCostPerUnit('0.15');
      setModalOpen(false);
    } catch {
      setError('Error al agregar propiedad');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/property/${deleteTarget.id}`, { method: 'DELETE' });
      setProperties((prev) => prev.filter((property) => property.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError('Error al eliminar propiedad y sus relacionados');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Building2}
        title="Propiedades"
        subtitle={`${properties.length} propiedades registradas`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nueva Propiedad"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Sin propiedades"
          description="Agrega tu primera propiedad para comenzar a gestionar departamentos e inquilinos."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 h-full hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <Link to={`/properties/${p.id}`} className="block min-w-0 flex-1 hover:no-underline">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 size={20} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                      <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
                        <MapPin size={14} />
                        <span className="truncate">{p.address}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="p-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                  title="Eliminar propiedad"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Propiedad">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Edificio Central"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Direccion</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Principal 123"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo Luz (por unidad)</label>
              <input
                type="number"
                step="0.01"
                value={lightCostPerUnit}
                onChange={(e) => setLightCostPerUnit(e.target.value)}
                placeholder="0.25"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Costo Agua (por unidad)</label>
              <input
                type="number"
                step="0.01"
                value={waterCostPerUnit}
                onChange={(e) => setWaterCostPerUnit(e.target.value)}
                placeholder="0.15"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {submitting ? 'Guardando...' : 'Guardar Propiedad'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Eliminar Propiedad"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              Esta acción eliminará la propiedad <strong>{deleteTarget?.name}</strong> y todos sus datos relacionados
              (departamentos, contratos, pagos, medidores, lecturas y cargos extra).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteProperty}
              disabled={deleting}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
