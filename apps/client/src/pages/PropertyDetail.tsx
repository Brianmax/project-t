import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  DoorOpen,
  Users,
  Gauge,
  CreditCard,
  Plus,
  Layers,
  BedDouble,
  Mail,
  Phone,
  DollarSign,
  Droplets,
  Zap,
} from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

// ── Types ──────────────────────────────────────────────

interface Property {
  id: number;
  name: string;
  address: string;
  lightCostPerUnit: number;
  waterCostPerUnit: number;
}

interface ConsumptionData {
  light: { consumption: number; cost: number; lastReading: number | null; prevReading: number | null };
  water: { consumption: number; cost: number; lastReading: number | null; prevReading: number | null };
}

interface Department {
  id: number;
  name: string;
  floor: number;
  numberOfRooms: number;
  property?: Property;
  isAvailable: boolean;
}

interface Tenant {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

interface Contract {
  id: number;
  startDate: string;
  endDate: string;
  rentAmount: number;
  advancePayment: number;
  guaranteeDeposit: number;
  tenant: Tenant;
  department: Department;
}

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

interface Payment {
  id: number;
  amount: number;
  date: string;
  description?: string;
  type: 'rent' | 'water' | 'light' | 'advance' | 'guarantee' | 'refund';
  contract: Contract;
}



type Tab = 'departments' | 'tenants' | 'meters' | 'payments';
type MeterSubTab = 'department' | 'property';

const typeLabels: Record<Payment['type'], string> = {
  rent: 'Alquiler',
  water: 'Agua',
  light: 'Luz',
  advance: 'Adelanto',
  guarantee: 'Garantia',
  refund: 'Devolucion',
};

const typeColors: Record<Payment['type'], string> = {
  rent: 'bg-blue-100 text-blue-700',
  water: 'bg-cyan-100 text-cyan-700',
  light: 'bg-amber-100 text-amber-700',
  advance: 'bg-violet-100 text-violet-700',
  guarantee: 'bg-emerald-100 text-emerald-700',
  refund: 'bg-rose-100 text-rose-700',
};

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm';
const btnCls =
  'w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors';

// ── Component ──────────────────────────────────────────

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);

  // Data state
  const [property, setProperty] = useState<Property | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allDeptMeters, setAllDeptMeters] = useState<DepartmentMeter[]>([]);
  const [allPropMeters, setAllPropMeters] = useState<PropertyMeter[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);

  const [consumptionMap, setConsumptionMap] = useState<Record<number, ConsumptionData>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [tab, setTab] = useState<Tab>('departments');
  const [meterSubTab, setMeterSubTab] = useState<MeterSubTab>('department');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Department form
  const [deptName, setDeptName] = useState('');
  const [deptFloor, setDeptFloor] = useState('');
  const [deptRooms, setDeptRooms] = useState('');
  const [deptWaterReading, setDeptWaterReading] = useState('');
  const [deptLightReading, setDeptLightReading] = useState('');
  const [deptWaterReadingDate, setDeptWaterReadingDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [deptLightReadingDate, setDeptLightReadingDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  // Tenant form
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');

  // Contract form (used in tenant tab)
  const [contractDeptId, setContractDeptId] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [contractRent, setContractRent] = useState('');
  const [contractAdvance, setContractAdvance] = useState('');
  const [contractGuarantee, setContractGuarantee] = useState('');

  // Meter form
  const [meterType, setMeterType] = useState<'light' | 'water'>('light');
  const [meterEntityId, setMeterEntityId] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payDesc, setPayDesc] = useState('');
  const [payType, setPayType] = useState<Payment['type']>('rent');
  const [payContractId, setPayContractId] = useState('');

  // Reading modal
  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [readingMeterId, setReadingMeterId] = useState<number | null>(null);
  const [readingValue, setReadingValue] = useState('');
  const [readingDate, setReadingDate] = useState('');

  // ── Derived / filtered data ──────────────────────────

  const departmentIds = useMemo(() => new Set(departments.map((d) => d.id)), [departments]);

  const contracts = useMemo(
    () => allContracts.filter((c) => departmentIds.has(c.department?.id)),
    [allContracts, departmentIds],
  );

  const contractIds = useMemo(() => new Set(contracts.map((c) => c.id)), [contracts]);

  const deptMeters = useMemo(
    () => allDeptMeters.filter((m) => departmentIds.has(m.department?.id)),
    [allDeptMeters, departmentIds],
  );

  const propMeters = useMemo(
    () => allPropMeters.filter((m) => m.property?.id === propertyId),
    [allPropMeters, propertyId],
  );

  const payments = useMemo(
    () => allPayments.filter((p) => contractIds.has(p.contract?.id)),
    [allPayments, contractIds],
  );

  const totalPayments = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);

  // ── Fetch all data on mount ──────────────────────────

  useEffect(() => {
    Promise.all([
      apiFetch<Property>(`/property/${propertyId}`),
      apiFetch<Department[]>(`/property/${propertyId}/departments`),
      apiFetch<Tenant[]>(`/property/${propertyId}/tenants`),
      apiFetch<Contract[]>('/contract'),
      apiFetch<DepartmentMeter[]>('/department-meter'),
      apiFetch<PropertyMeter[]>('/property-meter'),
      apiFetch<Payment[]>('/payment'),
    ])
      .then(([prop, depts, ten, con, dm, pm, pay]) => {
        setProperty(prop);
        setDepartments(depts);
        setTenants(ten);
        setAllContracts(con);
        setAllDeptMeters(dm);
        setAllPropMeters(pm);
        setAllPayments(pay);
      })
      .catch(() => setError('No se pudieron cargar los datos de la propiedad'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  // ── Fetch consumption for each department ──────────
  useEffect(() => {
    if (departments.length === 0) return;
    departments.forEach((dept) => {
      apiFetch<ConsumptionData>(`/consumption/department/${dept.id}`)
        .then((data) => {
          setConsumptionMap((prev) => ({ ...prev, [dept.id]: data }));
        })
        .catch(() => {/* ignore consumption fetch errors */});
    });
  }, [departments]);

  // ── Helpers ──────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const refreshConsumption = () => {
    departments.forEach((dept) => {
      apiFetch<ConsumptionData>(`/consumption/department/${dept.id}`)
        .then((data) => {
          setConsumptionMap((prev) => ({ ...prev, [dept.id]: data }));
        })
        .catch(() => {/* ignore */});
    });
  };

  const resetForm = () => {
    setDeptName(''); setDeptFloor(''); setDeptRooms('');
    setDeptWaterReading(''); setDeptLightReading('');
    setDeptWaterReadingDate(todayStr()); setDeptLightReadingDate(todayStr());
    setTenantName(''); setTenantEmail(''); setTenantPhone('');
    setContractDeptId(''); setContractStart(''); setContractEnd(''); setContractRent(''); setContractAdvance(''); setContractGuarantee('');
    setMeterType('light'); setMeterEntityId('');
    setPayAmount(''); setPayDate(''); setPayDesc(''); setPayType('rent'); setPayContractId('');
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  // ── Submit handlers ──────────────────────────────────

  const submitDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName || !deptFloor || !deptRooms) return;
    setSubmitting(true);
    try {
      const body: Record<string, string | number> = {
        name: deptName,
        floor: Number(deptFloor),
        numberOfRooms: Number(deptRooms),
        propertyId,
      };
      if (deptWaterReading) body.initialWaterReading = Number(deptWaterReading);
      if (deptWaterReading) body.initialWaterReadingDate = deptWaterReadingDate;
      if (deptLightReading) body.initialElectricityReading = Number(deptLightReading);
      if (deptLightReading) body.initialElectricityReadingDate = deptLightReadingDate;

      const added = await apiPost<Department>('/department', body);
      setDepartments((prev) => [...prev, added]);
      setModalOpen(false);
    } catch {
      setError('Error al agregar departamento');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTenantAndContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName || !tenantEmail || !contractDeptId || !contractStart || !contractEnd || !contractRent) {
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create Tenant
      const tenantBody: Record<string, string> = { name: tenantName, email: tenantEmail };
      if (tenantPhone) tenantBody.phone = tenantPhone;
      const newTenant = await apiPost<Tenant>('/tenant', tenantBody);

      // 2. Create Contract
      await apiPost('/contract', {
        startDate: contractStart,
        endDate: contractEnd,
        rentAmount: Number(contractRent),
        advancePayment: Number(contractAdvance) || 0,
        guaranteeDeposit: Number(contractGuarantee) || 0,
        tenantId: newTenant.id,
        departmentId: Number(contractDeptId),
      });

      // 3. Refresh data and close modal
      const [tenantsData, contractsData, deptsData] = await Promise.all([
        apiFetch<Tenant[]>(`/property/${propertyId}/tenants`),
        apiFetch<Contract[]>('/contract'),
        apiFetch<Department[]>(`/property/${propertyId}/departments`),
      ]);
      setTenants(tenantsData);
      setAllContracts(contractsData);
      setDepartments(deptsData);
      setModalOpen(false);
    } catch {
      setError('Error al agregar inquilino. Verifique que el email no esté ya registrado.');
    } finally {
      setSubmitting(false);
    }
  };



  const submitMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meterSubTab === 'department' && !meterEntityId) return;
    setSubmitting(true);
    try {
      if (meterSubTab === 'department') {
        const added = await apiPost<DepartmentMeter>('/department-meter', {
          meterType,
          departmentId: Number(meterEntityId),
        });
        setAllDeptMeters((prev) => [...prev, added]);
        setModalOpen(false);
        setReadingMeterId(added.id);
        setReadingValue('');
        setReadingDate(todayStr());
        setReadingModalOpen(true);
      } else {
        const added = await apiPost<PropertyMeter>('/property-meter', {
          meterType,
          propertyId,
        });
        setAllPropMeters((prev) => [...prev, added]);
        setModalOpen(false);
      }
    } catch {
      setError('Error al agregar medidor');
    } finally {
      setSubmitting(false);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || !payDate || !payContractId) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(payAmount),
        date: payDate,
        type: payType,
        contractId: Number(payContractId),
      };
      if (payDesc) body.description = payDesc;
      const added = await apiPost<Payment>('/payment', body);
      setAllPayments((prev) => [...prev, added]);
      setModalOpen(false);
    } catch {
      setError('Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingValue || !readingDate || !readingMeterId) return;
    setSubmitting(true);
    try {
      await apiPost('/meter-reading', {
        reading: Number(readingValue),
        date: readingDate,
        departmentMeterId: readingMeterId,
      });
      setReadingModalOpen(false);
      refreshConsumption();
    } catch {
      setError('Error al registrar lectura');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────

  if (loading) return <Spinner />;

  if (!property) {
    return (
      <div className="animate-fade-in">
        <EmptyState icon={Building2} title="Propiedad no encontrada" description="La propiedad solicitada no existe." />
        <div className="text-center mt-4">
          <Link to="/properties" className="text-primary-600 hover:underline text-sm">Volver a Propiedades</Link>
        </div>
      </div>
    );
  }


  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'departments', label: 'Departamentos', count: departments.length },
    { key: 'tenants', label: 'Inquilinos', count: tenants.length },
    { key: 'meters', label: 'Medidores', count: deptMeters.length + propMeters.length },
    { key: 'payments', label: 'Pagos', count: payments.length },
  ];

  const statCards: { label: string; value: number; icon: typeof Building2; color: string }[] = [
    { label: 'Departamentos', value: departments.length, icon: DoorOpen, color: 'bg-violet-50 text-violet-600' },
    { label: 'Inquilinos', value: tenants.length, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Medidores', value: deptMeters.length + propMeters.length, icon: Gauge, color: 'bg-cyan-50 text-cyan-600' },
    { label: 'Pagos', value: payments.length, icon: CreditCard, color: 'bg-blue-50 text-blue-600' },
  ];

  const modalTitle: Record<Tab, string> = {
    departments: 'Nuevo Departamento',
    tenants: 'Nuevo Inquilino',
    meters: `Nuevo Medidor (${meterSubTab === 'department' ? 'Departamento' : 'Propiedad'})`,
    payments: 'Nuevo Pago',
  };

  const submitHandler: Record<Tab, (e: React.FormEvent) => Promise<void>> = {
    departments: submitDepartment,
    tenants: submitTenantAndContract,
    meters: submitMeter,
    payments: submitPayment,
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/properties"
          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{property.name}</h1>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
            <MapPin size={14} />
            <span className="truncate">{property.address}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={openModal}
          disabled={(tab === 'tenants') && !departments.some(d => d.isAvailable)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
          title={(tab === 'tenants') && !departments.some(d => d.isAvailable) ? 'No hay departamentos disponibles' : ''}
        >
          <Plus size={16} />
          Agregar
        </button>
      </div>

      {/* ── TAB: Departamentos ──────────────────────── */}
      {tab === 'departments' && (
        departments.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Sin departamentos" description="Agrega departamentos a esta propiedad." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <DoorOpen size={20} className="text-violet-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">
                        <Link to={`/department/${d.id}`} className="hover:text-primary-600 hover:underline">{d.name}</Link>
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${d.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {d.isAvailable ? 'Disponible' : 'Ocupado'}
                      </span>
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
                {/* Consumption */}
                {consumptionMap[d.id] ? (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Zap size={14} className="text-amber-500 mt-0.5" />
                      <div className="text-xs text-slate-600">
                        {consumptionMap[d.id].light.prevReading !== null ? (
                          <>
                            <span className="font-medium text-slate-900">{consumptionMap[d.id].light.consumption} u</span>
                            <span className="block text-emerald-600 font-medium">S/ {consumptionMap[d.id].light.cost.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Sin lecturas</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Droplets size={14} className="text-blue-500 mt-0.5" />
                      <div className="text-xs text-slate-600">
                        {consumptionMap[d.id].water.prevReading !== null ? (
                          <>
                            <span className="font-medium text-slate-900">{consumptionMap[d.id].water.consumption} u</span>
                            <span className="block text-emerald-600 font-medium">S/ {consumptionMap[d.id].water.cost.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Sin lecturas</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      )}

      {/* ── TAB: Inquilinos ─────────────────────────── */}
      {tab === 'tenants' && (
        tenants.length === 0 ? (
          <EmptyState icon={Users} title="Sin inquilinos" description="No hay inquilinos con contratos en esta propiedad." />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Nombre</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Departamento</th>
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
                        <Link to={`/tenant/${t.id}`} className="font-medium text-slate-900 hover:text-primary-600 hover:underline">
                          {t.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <DoorOpen size={14} className="text-slate-400" />
                        {contracts.filter(c => c.tenant?.id === t.id).sort((a, b) => b.endDate.localeCompare(a.endDate))[0]?.department?.name || '-'}
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
        )
      )}


      {/* ── TAB: Inquilinos ─────────────────────────── */}

      {/* ── TAB: Medidores ──────────────────────────── */}
      {tab === 'meters' && (
        <>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-4">
            <button
              onClick={() => setMeterSubTab('department')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${meterSubTab === 'department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Departamento ({deptMeters.length})
            </button>
            <button
              onClick={() => setMeterSubTab('property')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${meterSubTab === 'property' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Propiedad ({propMeters.length})
            </button>
          </div>

          {meterSubTab === 'department' ? (
            deptMeters.length === 0 ? (
              <EmptyState icon={Gauge} title="Sin medidores" description="No hay medidores de departamento registrados." />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                      <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                      <th className="text-left px-5 py-3 font-medium text-slate-600">Departamento</th>
                      <th className="text-left px-5 py-3 font-medium text-slate-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptMeters.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-500">#{m.id}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {m.meterType === 'water' ? (
                              <Droplets size={16} className="text-blue-500" />
                            ) : (
                              <Zap size={16} className="text-amber-500" />
                            )}
                            <span className="font-medium text-slate-900">{m.meterType === 'water' ? 'Agua' : 'Luz'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{m.department?.name || 'N/A'}</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => {
                              setReadingMeterId(m.id);
                              setReadingValue('');
                              setReadingDate(todayStr());
                              setReadingModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                            title="Agregar Lectura"
                          >
                            <Plus size={14} />
                            Lectura
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            propMeters.length === 0 ? (
              <EmptyState icon={Gauge} title="Sin medidores" description="No hay medidores de propiedad registrados." />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-5 py-3 font-medium text-slate-600">ID</th>
                      <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                      <th className="text-left px-5 py-3 font-medium text-slate-600">Propiedad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {propMeters.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-500">#{m.id}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {m.meterType === 'water' ? (
                              <Droplets size={16} className="text-blue-500" />
                            ) : (
                              <Zap size={16} className="text-amber-500" />
                            )}
                            <span className="font-medium text-slate-900">{m.meterType === 'water' ? 'Agua' : 'Luz'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{m.property?.name || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}

      {/* ── TAB: Pagos ──────────────────────────────── */}
      {tab === 'payments' && (
        <>
          {payments.length > 0 && (
            <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total recaudado</p>
                <p className="text-2xl font-bold text-slate-900">S/ {totalPayments.toFixed(2)}</p>
              </div>
            </div>
          )}

          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin pagos" description="Registra pagos asociados a contratos de esta propiedad." />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Contrato</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Descripcion</th>
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Fecha</th>
                    <th className="text-right px-5 py-3 font-medium text-slate-600">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[p.type]}`}>
                          {typeLabels[p.type]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        #{p.contract?.id} - {p.contract?.tenant?.name || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                        {p.description || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{formatDate(p.date)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-600">
                        S/ {p.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Create Modal ────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle[tab]}>
        <form onSubmit={submitHandler[tab]} className="space-y-4">
          {tab === 'departments' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Depto 101" required className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Piso</label>
                  <input type="number" value={deptFloor} onChange={(e) => setDeptFloor(e.target.value)} placeholder="1" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">N° Habitaciones</label>
                  <input type="number" value={deptRooms} onChange={(e) => setDeptRooms(e.target.value)} placeholder="2" required className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lectura Inicial Agua</label>
                  <input type="number" value={deptWaterReading} onChange={(e) => setDeptWaterReading(e.target.value)} placeholder="0" className={inputCls} />
                  <label className="block text-sm font-medium text-slate-700 mb-1 mt-2">Fecha Lectura Agua</label>
                  <input
                    type="date"
                    value={deptWaterReadingDate}
                    onChange={(e) => setDeptWaterReadingDate(e.target.value)}
                    required={Boolean(deptWaterReading)}
                    disabled={!deptWaterReading}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lectura Inicial Luz</label>
                  <input type="number" value={deptLightReading} onChange={(e) => setDeptLightReading(e.target.value)} placeholder="0" className={inputCls} />
                  <label className="block text-sm font-medium text-slate-700 mb-1 mt-2">Fecha Lectura Luz</label>
                  <input
                    type="date"
                    value={deptLightReadingDate}
                    onChange={(e) => setDeptLightReadingDate(e.target.value)}
                    required={Boolean(deptLightReading)}
                    disabled={!deptLightReading}
                    className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'tenants' && (
            <>
              <h4 className="text-base font-semibold text-slate-800 border-b pb-2">Datos del Inquilino</h4>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (Opcional)</label>
                <input type="text" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className={inputCls} />
              </div>

              <h4 className="text-base font-semibold text-slate-800 border-b pb-2 mt-2">Contrato</h4>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                <select value={contractDeptId} onChange={(e) => setContractDeptId(e.target.value)} required className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {departments.filter(d => d.isAvailable).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
                  <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
                  <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Renta Mensual</label>
                <input type="number" step="0.01" value={contractRent} onChange={(e) => setContractRent(e.target.value)} placeholder="1500.00" required className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adelanto</label>
                  <input type="number" step="0.01" value={contractAdvance} onChange={(e) => setContractAdvance(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Garantía</label>
                  <input type="number" step="0.01" value={contractGuarantee} onChange={(e) => setContractGuarantee(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </>
          )}

          {tab === 'meters' && (
            <>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-2">
                <button
                  type="button"
                  onClick={() => { setMeterSubTab('department'); setMeterEntityId(''); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${meterSubTab === 'department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                >
                  Departamento
                </button>
                <button
                  type="button"
                  onClick={() => { setMeterSubTab('property'); setMeterEntityId(''); }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${meterSubTab === 'property' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
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
              {meterSubTab === 'department' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                  <select value={meterEntityId} onChange={(e) => setMeterEntityId(e.target.value)} required className={inputCls}>
                    <option value="">Seleccionar...</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Propiedad</label>
                  <input type="text" value={property.name} disabled className={inputCls + ' bg-slate-50 text-slate-500'} />
                </div>
              )}
            </>
          )}

          {tab === 'payments' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contrato</label>
                <select value={payContractId} onChange={(e) => setPayContractId(e.target.value)} required className={inputCls}>
                  <option value="">Seleccionar contrato...</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} - {c.tenant?.name} ({c.department?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                  <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="500.00" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select value={payType} onChange={(e) => setPayType(e.target.value as Payment['type'])} className={inputCls}>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion (opcional)</label>
                <input type="text" value={payDesc} onChange={(e) => setPayDesc(e.target.value)} placeholder="Pago mensual enero" className={inputCls} />
              </div>
            </>
          )}

          <button type="submit" disabled={submitting} className={btnCls}>
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </Modal>

      {/* ── Reading Modal ────────────────────────────── */}
      <Modal isOpen={readingModalOpen} onClose={() => setReadingModalOpen(false)} title="Nueva Lectura">
        <form onSubmit={submitReading} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lectura</label>
            <input
              type="number"
              step="any"
              value={readingValue}
              onChange={(e) => setReadingValue(e.target.value)}
              placeholder="0"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <button type="submit" disabled={submitting} className={btnCls}>
            {submitting ? 'Guardando...' : 'Guardar Lectura'}
          </button>
        </form>
      </Modal>

    </div>
  );
}
