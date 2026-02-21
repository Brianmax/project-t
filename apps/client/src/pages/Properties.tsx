import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, MapPin, Trash2 } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import { inputCls, labelCls, btnPrimaryCls, btnSecondaryCls, btnDangerCls } from '../lib/styles';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Property {
  id: string;
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
    apiFetch<Property[]>('/properties')
      .then(setProperties)
      .catch(() => setError('No se pudieron cargar las propiedades'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    setSubmitting(true);
    try {
      const added = await apiPost<Property>('/properties', {
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
      await apiFetch(`/properties/${deleteTarget.id}`, { method: 'DELETE' });
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
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm flex items-center gap-2">
          <AlertTriangle size={15} className="flex-shrink-0" />
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
              className="group bg-surface rounded-2xl border border-border p-5 h-full hover:shadow-lg hover:shadow-shadow hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-3">
                <Link to={`/properties/${p.id}`} className="block min-w-0 flex-1 hover:no-underline">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0 ring-1 ring-blue-100 dark:ring-blue-800/40">
                      <Building2 size={19} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-on-surface truncate group-hover:text-primary-600 transition-colors">{p.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[13px] text-on-surface-muted">
                        <MapPin size={13} />
                        <span className="truncate">{p.address}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="p-2 rounded-lg text-on-surface-faint hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-150 opacity-0 group-hover:opacity-100"
                  title="Eliminar propiedad"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Propiedad">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Edificio Central"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Direccion</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Principal 123"
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Costo Luz (por unidad)</label>
              <input
                type="number"
                step="0.01"
                value={lightCostPerUnit}
                onChange={(e) => setLightCostPerUnit(e.target.value)}
                placeholder="0.25"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Costo Agua (por unidad)</label>
              <input
                type="number"
                step="0.01"
                value={waterCostPerUnit}
                onChange={(e) => setWaterCostPerUnit(e.target.value)}
                placeholder="0.15"
                className={inputCls}
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
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
          <div className="flex items-start gap-3 rounded-xl border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              Esta accion eliminara la propiedad <strong>{deleteTarget?.name}</strong> y todos sus datos relacionados
              (departamentos, contratos, pagos, medidores, lecturas y cargos extra).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className={`flex-1 ${btnSecondaryCls}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteProperty}
              disabled={deleting}
              className={`flex-1 ${btnDangerCls}`}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
