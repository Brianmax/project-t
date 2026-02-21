import { useState, useEffect, useMemo } from 'react';
import { Users, Mail, Phone, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, apiPost } from '../lib/api';
import { inputCls, labelCls, btnPrimaryCls } from '../lib/styles';
import DatePicker from '../components/DatePicker';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  status: 'pending_review' | 'approved' | 'denied';
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
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Contract form
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [contractRent, setContractRent] = useState('');
  const [contractAdvance, setContractAdvance] = useState('');
  const [contractGuarantee, setContractGuarantee] = useState('');

  const availableDepartments = useMemo(
    () => departments.filter(d => d.isAvailable),
    [departments],
  );

  const filteredDepartments = useMemo(
    () => selectedPropertyId
      ? availableDepartments.filter(d => d.property?.id === Number(selectedPropertyId))
      : [],
    [availableDepartments, selectedPropertyId],
  );

  useEffect(() => {
    Promise.all([
      apiFetch<Tenant[]>('/tenants'),
      apiFetch<Property[]>('/properties'),
      apiFetch<Department[]>('/departments'),
      apiFetch<PendingReceipt[]>('/contracts/receipts/pending'),
    ])
      .then(([t, p, d, r]) => { setTenants(t); setProperties(p); setDepartments(d); setPendingReceipts(r); })
      .catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone('');
    setSelectedPropertyId(''); setSelectedDeptId('');
    setContractStart(''); setContractEnd(''); setContractRent('');
    setContractAdvance(''); setContractGuarantee('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !selectedDeptId || !contractStart || !contractEnd || !contractRent) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = { name, email };
      if (phone) body.phone = phone;
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
    } catch {
      setError('Error al agregar inquilino. Verifique que el email no este ya registrado.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={Users}
        title="Inquilinos"
        subtitle={`${tenants.length} inquilinos registrados`}
        onAdd={availableDepartments.length > 0 ? () => { resetForm(); setModalOpen(true); } : undefined}
        addLabel={availableDepartments.length > 0 ? 'Nuevo Inquilino' : 'Sin departamentos disponibles'}
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
          {error}
        </div>
      )}

      {/* Pending Receipts Section */}
      {pendingReceipts.length > 0 && (
        <div className="mb-6 bg-surface rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-on-surface">Recibos Pendientes de Pago</h2>
            <span className="ml-auto text-sm font-medium text-on-surface-medium">
              {pendingReceipts.length} {pendingReceipts.length === 1 ? 'recibo' : 'recibos'}
            </span>
          </div>

          <div className="space-y-3">
            {pendingReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-surface-alt rounded-xl border border-border-light p-4 hover:shadow-md hover:shadow-shadow transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={16} className="text-primary-600 flex-shrink-0" />
                      <h3 className="font-semibold text-on-surface truncate">{receipt.tenantName}</h3>
                    </div>
                    <p className="text-sm text-on-surface-medium mb-1">
                      {receipt.departmentName} — {receipt.propertyAddress}
                    </p>
                    <p className="text-xs text-on-surface-muted">
                      Periodo: {receipt.period}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-on-surface-medium mb-1">
                      Total: <span className="font-medium text-on-surface">S/ {receipt.totalDue.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-on-surface-medium mb-1">
                      Pagado: <span className="font-medium text-emerald-600 dark:text-emerald-400">S/ {receipt.totalPayments.toFixed(2)}</span>
                    </div>
                    <div className="text-sm font-bold text-red-600 dark:text-red-400">
                      Debe: S/ {Math.abs(receipt.balance).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border-light">
                  <Link
                    to={`/departments/${receipt.contractId}/billing`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Ver detalles
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border-light">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold text-on-surface">Total Adeudado:</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">
                S/ {pendingReceipts.reduce((sum, r) => sum + Math.abs(r.balance), 0).toFixed(2)}
              </span>
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
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light bg-surface-alt/80">
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Nombre</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider">Telefono</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-border-light last:border-0 hover:bg-surface-alt/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 dark:from-emerald-900/40 to-emerald-50 dark:to-emerald-950/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold text-xs ring-1 ring-emerald-200/50 dark:ring-emerald-700/40">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-on-surface">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-on-surface-medium">
                      <Mail size={14} className="text-on-surface-faint" />
                      {t.email}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {t.phone ? (
                      <div className="flex items-center gap-1.5 text-on-surface-medium">
                        <Phone size={14} className="text-on-surface-faint" />
                        {t.phone}
                      </div>
                    ) : (
                      <span className="text-on-surface-ghost">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Inquilino">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="pb-3 mb-1 border-b border-border-light">
            <h4 className="text-[13px] font-semibold text-on-surface-strong uppercase tracking-wider">Datos del Inquilino</h4>
          </div>
          <div>
            <label className={labelCls}>Nombre</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Perez" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@email.com" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefono (opcional)</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 999 999 999" className={inputCls} />
          </div>

          <div className="pb-3 mb-1 border-b border-border-light pt-2">
            <h4 className="text-[13px] font-semibold text-on-surface-strong uppercase tracking-wider">Contrato</h4>
          </div>
          <div>
            <label className={labelCls}>Propiedad</label>
            <select value={selectedPropertyId} onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedDeptId(''); }} required className={inputCls}>
              <option value="">Seleccionar...</option>
              {properties.filter(p => availableDepartments.some(d => d.property?.id === p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Departamento</label>
            <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)} required disabled={!selectedPropertyId} className={inputCls}>
              <option value="">Seleccionar...</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha Inicio</label>
              <DatePicker value={contractStart} onChange={setContractStart} required />
            </div>
            <div>
              <label className={labelCls}>Fecha Fin</label>
              <DatePicker value={contractEnd} onChange={setContractEnd} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Renta Mensual</label>
            <input type="number" step="0.01" value={contractRent} onChange={(e) => setContractRent(e.target.value)} placeholder="1500.00" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Adelanto</label>
              <input type="number" step="0.01" value={contractAdvance} onChange={(e) => setContractAdvance(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Garantia</label>
              <input type="number" step="0.01" value={contractGuarantee} onChange={(e) => setContractGuarantee(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={btnPrimaryCls}
          >
            {submitting ? 'Guardando...' : 'Guardar Inquilino'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
