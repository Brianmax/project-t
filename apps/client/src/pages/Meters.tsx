import { useState, useEffect } from 'react';
import { Gauge, Droplets, Zap } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/Skeleton';
import Modal from '../components/Modal';
import {
  inputCls,
  btnPrimaryCls,
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../lib/styles';
import { showSuccess, showError } from '../lib/toast';

interface Department {
  id: string;
  name: string;
}

interface DepartmentMeter {
  id: string;
  meterType: 'light' | 'water';
  department: Department;
}

export default function Meters() {
  const [deptMeters, setDeptMeters] = useState<DepartmentMeter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [meterType, setMeterType] = useState<'light' | 'water'>('light');
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<DepartmentMeter[]>('/department-meters'),
      apiFetch<Department[]>('/departments'),
    ])
      .then(([dm, d]) => {
        setDeptMeters(dm);
        setDepartments(d);
      })
      .catch(() => showError('No se pudieron cargar los medidores'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const added = await apiPost<DepartmentMeter>('/department-meters', {
        meterType,
        departmentId: selectedId,
      });
      setDeptMeters((prev) => [...prev, added]);
      setSelectedId('');
      setModalOpen(false);
      showSuccess('Medidor agregado exitosamente');
    } catch {
      showError('Error al agregar medidor');
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

  if (loading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Gauge}
        title="Medidores"
        subtitle={`${deptMeters.length} medidores en total`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Medidor"
      />

      {deptMeters.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Sin medidores"
          description="No hay medidores de departamento registrados."
        />
      ) : (
        <div className={tableContainerCls}>
          <table className="w-full text-sm">
            <thead>
              <tr className={tableHeaderCls}>
                <th className={tableHeaderCellCls}>ID</th>
                <th className={tableHeaderCellCls}>Tipo</th>
                <th className={tableHeaderCellCls}>Departamento</th>
              </tr>
            </thead>
            <tbody>
              {deptMeters.map((m) => (
                <tr key={m.id} className={tableRowCls}>
                  <td
                    className={`${tableCellCls} font-mono text-on-surface-muted`}
                  >
                    #{m.id}
                  </td>
                  <td className={tableCellCls}>
                    <div className="flex items-center gap-2">
                      <MeterIcon type={m.meterType} />
                      <span className="capitalize font-medium text-on-surface">
                        {m.meterType === 'water' ? 'Agua' : 'Luz'}
                      </span>
                    </div>
                  </td>
                  <td className={`${tableCellCls} text-on-surface-medium`}>
                    {m.department?.name || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo Medidor"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Tipo de Medidor
            </label>
            <select
              value={meterType}
              onChange={(e) =>
                setMeterType(e.target.value as 'light' | 'water')
              }
              className={inputCls}
            >
              <option value="light">Luz</option>
              <option value="water">Agua</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Departamento
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Seleccionar...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Agregar Medidor'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
