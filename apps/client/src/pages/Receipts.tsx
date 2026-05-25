import { useState, useEffect, useMemo } from 'react';
import { Receipt as ReceiptIcon, Building2, DoorOpen, Search, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import PageHeader from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import {
  inputCls,
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../lib/styles';

interface Property {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  property?: Property;
}

interface ReceiptData {
  id: string;
  contractId: string;
  month: number;
  year: number;
  status: 'unpaid' | 'paid';
  tenantName: string;
  departmentName: string;
  period: string;
  totalDue: number;
  balance: number;
}

export default function Receipts() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<Property[]>('/properties'),
      apiFetch<Department[]>('/departments'),
    ])
      .then(([p, d]) => {
        setProperties(p);
        setDepartments(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredDepartments = useMemo(
    () =>
      selectedPropertyId
        ? departments.filter((d) => d.property?.id === selectedPropertyId)
        : [],
    [departments, selectedPropertyId],
  );

  useEffect(() => {
    if (selectedDeptId) {
      setReceiptsLoading(true);
      apiFetch<ReceiptData[]>(`/contracts/receipts?departmentId=${selectedDeptId}`)
        .then(setReceipts)
        .finally(() => setReceiptsLoading(false));
    } else {
      setReceipts([]);
    }
  }, [selectedDeptId]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={ReceiptIcon}
        title="Recibos"
        subtitle="Consulta el historial de recibos por departamento"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-surface rounded-2xl border border-border p-5 shadow-sm">
        <div>
          <label className="block text-[13px] font-semibold text-on-surface-medium mb-1.5 tracking-wide flex items-center gap-2">
            <Building2 size={14} className="text-on-surface-faint" />
            Propiedad
          </label>
          <select
            value={selectedPropertyId}
            onChange={(e) => {
              setSelectedPropertyId(e.target.value);
              setSelectedDeptId('');
            }}
            className={inputCls}
          >
            <option value="">Seleccionar propiedad...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-on-surface-medium mb-1.5 tracking-wide flex items-center gap-2">
            <DoorOpen size={14} className="text-on-surface-faint" />
            Departamento (Apartamento)
          </label>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            disabled={!selectedPropertyId}
            className={inputCls}
          >
            <option value="">Seleccionar departamento...</option>
            {filteredDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedDeptId ? (
        <EmptyState
          icon={Search}
          title="Selecciona un departamento"
          description="Selecciona una propiedad y luego un departamento para ver sus recibos."
        />
      ) : receiptsLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-muted text-sm">Cargando recibos...</p>
        </div>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="Sin recibos"
          description="Este departamento no tiene recibos generados todavía."
        />
      ) : (
        <div className={tableContainerCls}>
          <table className="w-full text-sm">
            <thead>
              <tr className={tableHeaderCls}>
                <th className={tableHeaderCellCls}>Periodo</th>
                <th className={tableHeaderCellCls}>Inquilino</th>
                <th className={tableHeaderCellCls}>Estado</th>
                <th className={tableHeaderCellCls}>Total</th>
                <th className={`${tableHeaderCellCls} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className={tableRowCls}>
                  <td className={`${tableCellCls} font-medium text-on-surface`}>
                    {r.period}
                  </td>
                  <td className={`${tableCellCls} text-on-surface-medium`}>
                    {r.tenantName}
                  </td>
                  <td className={tableCellCls}>
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${
                        r.status === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200/50 dark:ring-emerald-700/40'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200/50 dark:ring-amber-700/40'
                      }`}
                    >
                      {r.status === 'paid' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className={`${tableCellCls} font-semibold text-on-surface`}>
                    S/ {r.totalDue.toFixed(2)}
                  </td>
                  <td className={`${tableCellCls} text-right`}>
                    <Link
                      to={`/departments/${selectedDeptId}/billing?month=${r.month}&year=${r.year}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg transition-colors"
                    >
                      <Eye size={14} />
                      Ver Detalles
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
