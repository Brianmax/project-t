import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Building2, Layers, BedDouble } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import { inputCls, btnPrimaryCls } from '../lib/styles';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
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

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const [waterReading, setWaterReading] = useState('');
  const [electricityReading, setElectricityReading] = useState('');
  const [initialDate, setInitialDate] = useState(today);
  const [initialBillingMonth, setInitialBillingMonth] = useState(now.getMonth() + 1);
  const [initialBillingYear, setInitialBillingYear] = useState(now.getFullYear());

  useEffect(() => {
    Promise.all([
      apiFetch<Department[]>('/departments'),
      apiFetch<Property[]>('/properties'),
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
      const added = await apiPost<Department>('/departments', {
        name,
        floor: Number(floor),
        numberOfRooms: Number(rooms),
        propertyId: propertyId,
        initialWaterReading: Number(waterReading),
        initialWaterReadingDate: initialDate,
        initialElectricityReading: Number(electricityReading),
        initialElectricityReadingDate: initialDate,
        initialBillingMonth,
        initialBillingYear,
      });
      setDepartments((prev) => [...prev, added]);
      setName('');
      setFloor('');
      setRooms('');
      setPropertyId('');
      setWaterReading('');
      setElectricityReading('');
      setInitialDate(new Date().toISOString().split('T')[0]);
      setInitialBillingMonth(new Date().getMonth() + 1);
      setInitialBillingYear(new Date().getFullYear());
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
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
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
              className="group bg-surface rounded-2xl border border-border p-5 hover:shadow-lg hover:shadow-shadow hover:border-border transition-all duration-200"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0 ring-1 ring-violet-100 dark:ring-violet-800/40">
                  <DoorOpen size={19} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-on-surface truncate">
                    <Link to={`/departments/${d.id}`} className="hover:text-primary-600 transition-colors">{d.name}</Link>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
                    <Building2 size={13} />
                    <span>{d.property?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-3 border-t border-border-light">
                <div className="flex items-center gap-1.5 text-[13px] text-on-surface-medium">
                  <Layers size={13} className="text-on-surface-faint" />
                  Piso {d.floor}
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-on-surface-medium">
                  <BedDouble size={13} className="text-on-surface-faint" />
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
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Depto 101"
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Piso</label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="1"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Habitaciones</label>
              <input
                type="number"
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                placeholder="2"
                required
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Propiedad</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Seleccionar propiedad...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <p className="text-[13px] font-semibold text-on-surface-medium mb-3">Lecturas Iniciales</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Lectura Inicial Agua</label>
                  <input
                    type="number"
                    step="0.01"
                    value={waterReading}
                    onChange={(e) => setWaterReading(e.target.value)}
                    placeholder="0"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Lectura Inicial Luz</label>
                  <input
                    type="number"
                    step="0.01"
                    value={electricityReading}
                    onChange={(e) => setElectricityReading(e.target.value)}
                    placeholder="0"
                    required
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Fecha de Lectura</label>
                <DatePicker value={initialDate} onChange={setInitialDate} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Mes de Facturación</label>
                  <select value={initialBillingMonth} onChange={(e) => setInitialBillingMonth(Number(e.target.value))} required className={inputCls}>
                    {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((n, i) => (
                      <option key={i + 1} value={i + 1}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">Año de Facturación</label>
                  <input type="number" value={initialBillingYear} onChange={(e) => setInitialBillingYear(Number(e.target.value))} required className={inputCls} min={2000} max={2100} />
                </div>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={btnPrimaryCls}
          >
            {submitting ? 'Guardando...' : 'Guardar Departamento'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
