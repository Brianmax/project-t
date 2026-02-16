import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    FileText,
    Calendar,
    DollarSign,
    CreditCard,
    Building2,
    Clock
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

// ── Types ──────────────────────────────────────────────

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
    guaranteeDeposit: number;
    tenant?: {
        id: number;
        name: string;
    };
    department?: {
        id: number;
        name: string;
        property?: {
            id: number;
            name: string;
            address: string;
        };
    };
}

interface Payment {
    id: number;
    amount: number;
    date: string;
    type: string;
    contract?: { id: number };
}

// ── Component ──────────────────────────────────────────

export default function TenantDashboard() {
    const { id } = useParams<{ id: string }>();
    const tenantId = Number(id);

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            apiFetch<Tenant>(`/tenant/${tenantId}`),
            apiFetch<Contract[]>(`/contract`), // We'll filter client-side for now as we don't have a specific endpoint
            apiFetch<Payment[]>(`/payment`),   // We'll filter client-side
        ])
            .then(([t, allContracts, allPayments]) => {
                setTenant(t);

                // Filter contracts for this tenant
                const tenantContracts = allContracts.filter(c => c.tenant?.id === tenantId);
                // Sort by date desc
                tenantContracts.sort((a, b) => b.endDate.localeCompare(a.endDate));
                setContracts(tenantContracts);

                // Filter payments for these contracts
                const contractIds = new Set(tenantContracts.map(c => c.id));
                const tenantPayments = allPayments.filter(p => p.contract && contractIds.has(p.contract.id));
                // Sort by date desc
                tenantPayments.sort((a, b) => b.date.localeCompare(a.date));
                setPayments(tenantPayments);
            })
            .catch((err) => {
                console.error(err);
                setError('Error al cargar datos del inquilino');
            })
            .finally(() => setLoading(false));
    }, [tenantId]);

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

    if (loading) return <Spinner />;

    if (!tenant) {
        return (
            <div className="animate-fade-in">
                <EmptyState icon={User} title="Inquilino no encontrado" description="El inquilino solicitado no existe." />
                <div className="text-center mt-4">
                    <Link to="/" className="text-primary-600 hover:underline text-sm">Volver al Inicio</Link>
                </div>
            </div>
        );
    }

    const activeContract = contracts.find(c => new Date(c.endDate) >= new Date());
    const pastContracts = contracts.filter(c => c !== activeContract);

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link
                    to={activeContract?.department?.property ? `/properties/${activeContract.department.property.id}` : "/tenants"}
                    className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-slate-900 truncate">{tenant.name}</h1>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-0.5">
                        <div className="flex items-center gap-1.5">
                            <Mail size={14} />
                            {tenant.email}
                        </div>
                        {tenant.phone && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={14} />
                                {tenant.phone}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Column: Active Contract & History */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Active Contract */}
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Building2 size={20} className="text-primary-600" />
                            Contrato Actual
                        </h2>
                        {activeContract ? (
                            <div className="bg-white rounded-2xl border border-primary-100 shadow-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                        <Clock size={12} /> Activo
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-slate-900">{activeContract.department?.name || 'Departamento'}</h3>
                                    <p className="text-slate-500 text-sm">{activeContract.department?.property?.name} - {activeContract.department?.property?.address}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-slate-500 text-xs mb-1">Periodo</p>
                                        <div className="font-medium text-slate-900 flex items-center gap-2">
                                            <Calendar size={14} className="text-slate-400" />
                                            {formatDate(activeContract.startDate)} - {formatDate(activeContract.endDate)}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-slate-500 text-xs mb-1">Renta Mensual</p>
                                        <div className="font-medium text-slate-900 flex items-center gap-2">
                                            <DollarSign size={14} className="text-slate-400" />
                                            S/ {Number(activeContract.rentAmount).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50">
                                        <p className="text-slate-500 text-xs mb-1">Garantía</p>
                                        <div className="font-medium text-slate-900 flex items-center gap-2">
                                            <DollarSign size={14} className="text-slate-400" />
                                            S/ {Number(activeContract.guaranteeDeposit).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center">
                                <p className="text-slate-500">Este inquilino no tiene un contrato activo actualmente.</p>
                            </div>
                        )}
                    </section>

                    {/* Contract History */}
                    {pastContracts.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <FileText size={20} className="text-slate-400" />
                                Historial de Contratos
                            </h2>
                            <div className="space-y-3">
                                {pastContracts.map(c => (
                                    <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-75 hover:opacity-100 transition-opacity">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-medium text-slate-900">{c.department?.name}</h4>
                                                <p className="text-xs text-slate-500">{c.department?.property?.name}</p>
                                            </div>
                                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">Finalizado</span>
                                        </div>
                                        <div className="text-sm text-slate-600 flex gap-4">
                                            <span className="flex items-center gap-1.5"><Calendar size={14} /> {formatDate(c.startDate)} - {formatDate(c.endDate)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                </div>

                {/* Sidebar: Payments */}
                <div className="space-y-6">
                    <section>
                        <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <CreditCard size={20} className="text-blue-600" />
                            Ultimos Pagos
                        </h2>

                        {payments.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No hay pagos registrados.</p>
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="divide-y divide-slate-100">
                                    {payments.map(p => (
                                        <div key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium text-slate-900">S/ {Number(p.amount).toFixed(2)}</span>
                                                <span className="text-xs text-slate-500">{formatDate(p.date)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className={`px-2 py-0.5 rounded-md ${p.type === 'rent' ? 'bg-blue-100 text-blue-700' :
                                                        p.type === 'water' ? 'bg-cyan-100 text-cyan-700' :
                                                            p.type === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {p.type === 'rent' ? 'Alquiler' : p.type === 'water' ? 'Agua' : p.type === 'light' ? 'Luz' : p.type}
                                                </span>
                                                <span className="text-slate-400">#{p.contract?.id}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

            </div>
        </div>
    );
}
