import { useState, useEffect, useMemo } from 'react';
import { Users, Mail, Phone } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Tenant {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface Property {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  isAvailable: boolean;
  property?: Property;
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
      apiFetch<Tenant[]>('/tenant'),
      apiFetch<Property[]>('/property'),
      apiFetch<Department[]>('/department'),
    ])
      .then(([t, p, d]) => { setTenants(t); setProperties(p); setDepartments(d); })
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
      // 1. Create tenant
      const body: Record<string, string> = { name, email };
      if (phone) body.phone = phone;
      const added = await apiPost<Tenant>('/tenant', body);

      // 2. Create contract
      await apiPost('/contract', {
        startDate: contractStart,
        endDate: contractEnd,
        rentAmount: Number(contractRent),
        advancePayment: Number(contractAdvance) || 0,
        guaranteeDeposit: Number(contractGuarantee) || 0,
        tenantId: added.id,
        departmentId: Number(selectedDeptId),
      });

      // 3. Refresh
      const [tenantsData, deptsData] = await Promise.all([
        apiFetch<Tenant[]>('/tenant'),
        apiFetch<Department[]>('/department'),
      ]);
      setTenants(tenantsData);
      setDepartments(deptsData);
      resetForm();
      setModalOpen(false);
    } catch {
      setError('Error al agregar inquilino. Verifique que el email no esté ya registrado.');
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
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin inquilinos"
          description="Registra inquilinos para asociarlos a contratos."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Telefono</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-xs">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Mail size={14} className="text-slate-400" />
                      {t.email}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {t.phone ? (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        {t.phone}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
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
          <h4 className="text-base font-semibold text-slate-800 border-b pb-2">Datos del Inquilino</h4>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Perez"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@email.com"
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (opcional)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+51 999 999 999"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            />
          </div>

          <h4 className="text-base font-semibold text-slate-800 border-b pb-2 mt-2">Contrato</h4>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Propiedad</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => { setSelectedPropertyId(e.target.value); setSelectedDeptId(''); }}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm"
            >
              <option value="">Seleccionar...</option>
              {properties.filter(p => availableDepartments.some(d => d.property?.id === p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              required
              disabled={!selectedPropertyId}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Seleccionar...</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
              <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
              <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Renta Mensual</label>
            <input type="number" step="0.01" value={contractRent} onChange={(e) => setContractRent(e.target.value)} placeholder="1500.00" required className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adelanto</label>
              <input type="number" step="0.01" value={contractAdvance} onChange={(e) => setContractAdvance(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Garantía</label>
              <input type="number" step="0.01" value={contractGuarantee} onChange={(e) => setContractGuarantee(e.target.value)} placeholder="0.00" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {submitting ? 'Guardando...' : 'Guardar Inquilino'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
