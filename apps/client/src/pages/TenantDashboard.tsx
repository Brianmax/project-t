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
    Clock,
    AlertCircle
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

// ── Types ──────────────────────────────────────────────

interface Tenant {
    id: string;
    name: string;
    email: string;
    phone?: string;
}

interface Contract {
    id: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    guaranteeDeposit: number;
    tenant?: {
        id: string;
        name: string;
    };
    department?: {
        id: string;
        name: string;
        property?: {
            id: string;
            name: string;
            address: string;
        };
    };
}

interface Payment {
    id: string;
    amount: number;
    date: string;
    type: string;
    contract?: { id: string };
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

// ── Component ──────────────────────────────────────────

export default function TenantDashboard() {
    const { id } = useParams<{ id: string }>();
    const tenantId = id!;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            apiFetch<Tenant>(`/tenants/${tenantId}`),
            apiFetch<Contract[]>(`/contracts`),
            apiFetch<Payment[]>(`/payments`),
            apiFetch<PendingReceipt[]>(`/contracts/receipts/pending`),
        ])
            .then(([t, allContracts, allPayments, allPendingReceipts]) => {
                setTenant(t);

                const tenantContracts = allContracts.filter(c => c.tenant?.id === tenantId);
                tenantContracts.sort((a, b) => b.endDate.localeCompare(a.endDate));
                setContracts(tenantContracts);

                const contractIds = new Set(tenantContracts.map(c => c.id));
                const tenantPayments = allPayments.filter(p => p.contract && contractIds.has(p.contract.id));
                tenantPayments.sort((a, b) => b.date.localeCompare(a.date));
                setPayments(tenantPayments);

                const tenantReceipts = allPendingReceipts.filter(r => contractIds.has(r.contractId));
                setPendingReceipts(tenantReceipts);
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
                    className="w-10 h-10 rounded-xl bg-surface-raised flex items-center justify-center text-on-surface-medium hover:bg-surface-raised hover:text-on-surface-strong transition-all duration-150 flex-shrink-0"
                >
                    <ArrowLeft size={19} />
                </Link>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-on-surface truncate tracking-tight">{tenant.name}</h1>
                    <div className="flex items-center gap-4 text-[13px] text-on-surface-muted mt-0.5">
                        <div className="flex items-center gap-1.5">
                            <Mail size={13} />
                            {tenant.email}
                        </div>
                        {tenant.phone && (
                            <div className="flex items-center gap-1.5">
                                <Phone size={13} />
                                {tenant.phone}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Column: Active Contract & History */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Active Contract */}
                    <section>
                        <h2 className="text-lg font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
                            <Building2 size={19} className="text-primary-600" />
                            Contrato Actual
                        </h2>
                        {activeContract ? (
                            <div className="bg-surface rounded-2xl border border-primary-100/80 shadow-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold ring-1 ring-emerald-200/50 dark:ring-emerald-700/40">
                                        <Clock size={11} /> Activo
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-on-surface tracking-tight">{activeContract.department?.name || 'Departamento'}</h3>
                                    <p className="text-on-surface-muted text-[13px]">{activeContract.department?.property?.name} - {activeContract.department?.property?.address}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="p-3 rounded-xl bg-surface-alt/80 ring-1 ring-border-ring">
                                        <p className="text-on-surface-muted text-[11px] mb-1 uppercase tracking-wider font-medium">Periodo</p>
                                        <div className="font-medium text-on-surface flex items-center gap-2">
                                            <Calendar size={13} className="text-on-surface-faint" />
                                            {formatDate(activeContract.startDate)} - {formatDate(activeContract.endDate)}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-surface-alt/80 ring-1 ring-border-ring">
                                        <p className="text-on-surface-muted text-[11px] mb-1 uppercase tracking-wider font-medium">Renta Mensual</p>
                                        <div className="font-medium text-on-surface flex items-center gap-2">
                                            <DollarSign size={13} className="text-on-surface-faint" />
                                            S/ {Number(activeContract.rentAmount).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-surface-alt/80 ring-1 ring-border-ring">
                                        <p className="text-on-surface-muted text-[11px] mb-1 uppercase tracking-wider font-medium">Garantia</p>
                                        <div className="font-medium text-on-surface flex items-center gap-2">
                                            <DollarSign size={13} className="text-on-surface-faint" />
                                            S/ {Number(activeContract.guaranteeDeposit).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-surface-alt rounded-2xl border border-border p-6 text-center">
                                <p className="text-on-surface-muted text-sm">Este inquilino no tiene un contrato activo actualmente.</p>
                            </div>
                        )}
                    </section>

                    {/* Pending Receipts */}
                    {pendingReceipts.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
                                <AlertCircle size={19} className="text-amber-600 dark:text-amber-400" />
                                Recibos Pendientes de Pago
                            </h2>
                            <div className="space-y-3">
                                {pendingReceipts.map((receipt) => (
                                    <div
                                        key={receipt.id}
                                        className="bg-surface rounded-xl border border-amber-200/80 dark:border-amber-700/40 p-4 shadow-sm hover:shadow-md transition-all duration-200"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-semibold text-on-surface mb-1">{receipt.period}</h3>
                                                <p className="text-sm text-on-surface-medium">
                                                    {receipt.departmentName}
                                                </p>
                                            </div>
                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-700/40">
                                                Pendiente
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                                            <div className="bg-surface-alt/80 rounded-lg p-2 ring-1 ring-border-ring">
                                                <p className="text-on-surface-muted text-[11px] mb-0.5">Total</p>
                                                <p className="font-medium text-on-surface">S/ {receipt.totalDue.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-surface-alt/80 rounded-lg p-2 ring-1 ring-border-ring">
                                                <p className="text-on-surface-muted text-[11px] mb-0.5">Pagado</p>
                                                <p className="font-medium text-emerald-600 dark:text-emerald-400">S/ {receipt.totalPayments.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-2 ring-1 ring-red-200/50 dark:ring-red-700/40">
                                                <p className="text-red-700 dark:text-red-300 text-[11px] mb-0.5">Debe</p>
                                                <p className="font-bold text-red-600 dark:text-red-400">S/ {Math.abs(receipt.balance).toFixed(2)}</p>
                                            </div>
                                        </div>

                                        <Link
                                            to={`/departments/${receipt.contractId}/billing`}
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                                        >
                                            Ver detalles y pagar
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200/60 dark:border-red-700/40">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-on-surface">Total Adeudado:</span>
                                    <span className="text-xl font-bold text-red-600 dark:text-red-400">
                                        S/ {pendingReceipts.reduce((sum, r) => sum + Math.abs(r.balance), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Contract History */}
                    {pastContracts.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
                                <FileText size={19} className="text-on-surface-faint" />
                                Historial de Contratos
                            </h2>
                            <div className="space-y-3">
                                {pastContracts.map(c => (
                                    <div key={c.id} className="bg-surface rounded-xl border border-border p-4 opacity-75 hover:opacity-100 transition-all duration-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-medium text-on-surface">{c.department?.name}</h4>
                                                <p className="text-xs text-on-surface-muted">{c.department?.property?.name}</p>
                                            </div>
                                            <span className="text-[11px] px-2 py-1 bg-surface-raised text-on-surface-medium rounded-lg font-medium">Finalizado</span>
                                        </div>
                                        <div className="text-sm text-on-surface-medium flex gap-4">
                                            <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(c.startDate)} - {formatDate(c.endDate)}</span>
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
                        <h2 className="text-lg font-semibold text-on-surface-strong mb-3 flex items-center gap-2">
                            <CreditCard size={19} className="text-blue-600 dark:text-blue-400" />
                            Ultimos Pagos
                        </h2>

                        {payments.length === 0 ? (
                            <p className="text-sm text-on-surface-muted italic">No hay pagos registrados.</p>
                        ) : (
                            <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                                <div className="divide-y divide-border-light">
                                    {payments.map(p => (
                                        <div key={p.id} className="p-4 hover:bg-surface-alt/50 transition-colors">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <span className="font-semibold text-on-surface">S/ {Number(p.amount).toFixed(2)}</span>
                                                <span className="text-[11px] text-on-surface-muted">{formatDate(p.date)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className={`px-2 py-0.5 rounded-md font-medium ${p.type === 'rent' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                                        p.type === 'water' ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300' :
                                                            p.type === 'light' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-surface-raised text-on-surface-medium'
                                                    }`}>
                                                    {p.type === 'rent' ? 'Alquiler' : p.type === 'water' ? 'Agua' : p.type === 'light' ? 'Luz' : p.type}
                                                </span>
                                                <span className="text-on-surface-faint font-mono">#{p.contract?.id}</span>
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
