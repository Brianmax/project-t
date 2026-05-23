import { useState, useEffect, useMemo } from 'react';
import { Users, Mail, Phone, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, apiPost } from '../lib/api';
import {
  inputCls,
  labelCls,
  btnPrimaryCls,
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../lib/styles';
import { showSuccess, showError } from '../lib/toast';
import DatePicker from '../components/DatePicker';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/Skeleton';
import Modal from '../components/Modal';

interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  documentId: string;
}

interface Property {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  isAvailable: boolean;
  property?: Property;
}

interface PendingReceipt {
  id: string;
  contractId: string;
  month: number;
  year: number;
  status: 'unpaid' | 'paid';
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  period: string;
  totalDue: number;
  totalPayments: number;
  balance: number;
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [contractRent, setContractRent] = useState('');
  const [contractAdvance, setContractAdvance] = useState('');
  const [contractGuarantee, setContractGuarantee] = useState('');

  const availableDepartments = useMemo(
    () => departments.filter((d) => d.isAvailable),
    [departments],
  );

  const filteredDepartments = useMemo(
    () =>
      selectedPropertyId
        ? availableDepartments.filter(
            (d) => d.property?.id === selectedPropertyId,
          )
        : [],
    [availableDepartments, selectedPropertyId],
  );

  useEffect(() => {
    Promise.all([
      apiFetch<Tenant[]>('/tenants'),
      apiFetch<Property[]>('/properties'),
      apiFetch<Department[]>('/departments'),
      apiFetch<PendingReceipt[]>('/contracts/receipts/unpaid'),
    ])
      .then(([t, p, d, r]) => {
        setTenants(t);
        setProperties(p);
        setDepartments(d);
        setPendingReceipts(r);
      })
      .catch(() => showError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setDocumentId('');
    setSelectedPropertyId('');
    setSelectedDeptId('');
    setContractStart('');
    setContractEnd('');
    setContractRent('');
    setContractAdvance('');
    setContractGuarantee('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name ||
      !phone ||
      !documentId ||
      !selectedDeptId ||
      !contractStart ||
      !contractEnd ||
      !contractRent
    )
      return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = { name, phone, documentId };
      if (email) body.email = email;
      const added = await apiPost<Tenant>('/tenants', body);

      await apiPost('/contracts', {
        startDate: contractStart,
        endDate: contractEnd,
        rentAmount: Number(contractRent),
        advancePayment: Number(contractAdvance) || 0,
        guaranteeDeposit: Number(contractGuarantee) || 0,
        tenantId: added.id,
        departmentId: selectedDeptId,
      });

      const [tenantsData, deptsData] = await Promise.all([
        apiFetch<Tenant[]>('/tenants'),
        apiFetch<Department[]>('/departments'),
      ]);
      setTenants(tenantsData);
      setDepartments(deptsData);
      resetForm();
      setModalOpen(false);
      showSuccess('Inquilino registrado exitosamente');
    } catch {
      showError(
        'Error al agregar inquilino. Verifique que el documento de identidad no este ya registrado.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Users}
        title="Inquilinos"
        subtitle={`${tenants.length} inquilinos registrados`}
        onAdd={
          availableDepartments.length > 0
            ? () => {
                resetForm();
                setModalOpen(true);
              }
            : undefined
        }
        addLabel={
          availableDepartments.length > 0
            ? 'Nuevo Inquilino'
            : 'Sin departamentos disponibles'
        }
      />

      {pendingReceipts.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 p-4 text-amber-900 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400"
            />
            <div>
              <p className="text-sm font-semibold">
                Recibos pendientes de pago
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200/80">
                Hay {pendingReceipts.length}{' '}
                {pendingReceipts.length === 1
                  ? 'recibo pendiente'
                  : 'recibos pendientes'}{' '}
                de pago.
              </p>
            </div>
          </div>
        </div>
      )}

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin inquilinos"
          description="Registra inquilinos para asociarlos a contratos."
        />
      ) : (
        <div className={tableContainerCls}>
          <table className="w-full text-sm">
            <thead>
              <tr className={tableHeaderCls}>
                <th className={tableHeaderCellCls}>Nombre</th>
                <th className={tableHeaderCellCls}>Email</th>
                <th className={tableHeaderCellCls}>Telefono</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className={tableRowCls}>
                  <td className={tableCellCls}>
                    <Link
                      to={`/tenants/${t.id}`}
                      className="flex items-center gap-3 hover:underline"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 dark:from-emerald-900/40 to-emerald-50 dark:to-emerald-950/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold text-xs ring-1 ring-emerald-200/50 dark:ring-emerald-700/40">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface">
                        {t.name}
                      </span>
                    </Link>
                  </td>
                  <td className={tableCellCls}>
                    {t.email ? (
                      <div className="flex items-center gap-1.5 text-on-surface-medium">
                        <Mail size={14} className="text-on-surface-faint" />
                        {t.email}
                      </div>
                    ) : (
                      <span className="text-on-surface-ghost">-</span>
                    )}
                  </td>
                  <td className={tableCellCls}>
                    <div className="flex items-center gap-1.5 text-on-surface-medium">
                      <Phone size={14} className="text-on-surface-faint" />
                      {t.phone}
                    </div>
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
        title="Nuevo Inquilino"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="pb-3 mb-1 border-b border-border-light">
            <h4 className="text-[13px] font-semibold text-on-surface-strong uppercase tracking-wider">
              Datos del Inquilino
            </h4>
          </div>
          <div>
            <label className={labelCls}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@email.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Telefono</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+51 999 999 999"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Documento de Identidad</label>
            <input
              type="text"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              placeholder="DNI 12345678"
              required
              className={inputCls}
            />
          </div>

          <div className="pb-3 mb-1 border-b border-border-light pt-2">
            <h4 className="text-[13px] font-semibold text-on-surface-strong uppercase tracking-wider">
              Contrato
            </h4>
          </div>
          <div>
            <label className={labelCls}>Propiedad</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                setSelectedDeptId('');
              }}
              required
              className={inputCls}
            >
              <option value="">Seleccionar...</option>
              {properties
                .filter((p) =>
                  availableDepartments.some((d) => d.property?.id === p.id),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Departamento</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              required
              disabled={!selectedPropertyId}
              className={inputCls}
            >
              <option value="">Seleccionar...</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha Inicio</label>
              <DatePicker
                value={contractStart}
                onChange={setContractStart}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Fecha Fin</label>
              <DatePicker
                value={contractEnd}
                onChange={setContractEnd}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Renta Mensual</label>
            <input
              type="number"
              step="0.01"
              value={contractRent}
              onChange={(e) => setContractRent(e.target.value)}
              placeholder="1500.00"
              required
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Adelanto</label>
              <input
                type="number"
                step="0.01"
                value={contractAdvance}
                onChange={(e) => setContractAdvance(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Garantia</label>
              <input
                type="number"
                step="0.01"
                value={contractGuarantee}
                onChange={(e) => setContractGuarantee(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className={btnPrimaryCls}>
            {submitting ? 'Guardando...' : 'Guardar Inquilino'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
