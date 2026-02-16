import { useState, useEffect } from 'react';
import { FileText, Calendar, DollarSign, Receipt, Scale } from 'lucide-react';
import { apiFetch, apiPost } from '../lib/api';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

interface Tenant { id: number; name: string; }
interface Property { id: number; name: string; }
interface Department { id: number; name: string; property: Property; }
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
interface ReceiptItem { description: string; amount: number; }
interface GeneratedReceipt {
  contractId: number;
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  period: string;
  items: ReceiptItem[];
  totalPayments: number;
  totalDue: number;
  balance: number;
}
interface SettlementResult {
  contractId: number;
  tenantName: string;
  departmentName: string;
  totalCharges: number;
  totalPayments: number;
  advancePaymentUsed: boolean;
  guaranteeDeduction: number;
  finalBalance: number;
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [advance, setAdvance] = useState('');
  const [guarantee, setGuarantee] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [receiptModal, setReceiptModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [receiptMonth, setReceiptMonth] = useState(String(new Date().getMonth() + 1));
  const [receiptYear, setReceiptYear] = useState(String(new Date().getFullYear()));
  const [receipt, setReceipt] = useState<GeneratedReceipt | null>(null);
  const [actualEndDate, setActualEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Contract[]>('/contract'),
      apiFetch<Tenant[]>('/tenant'),
      apiFetch<Department[]>('/department'),
    ])
      .then(([c, t, d]) => { setContracts(c); setTenants(t); setDepartments(d); })
      .catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !rentAmount || !tenantId || !departmentId) return;
    setSubmitting(true);
    try {
      const added = await apiPost<Contract>('/contract', {
        startDate,
        endDate,
        rentAmount: Number(rentAmount),
        advancePayment: Number(advance) || 0,
        guaranteeDeposit: Number(guarantee) || 0,
        tenantId: Number(tenantId),
        departmentId: Number(departmentId),
      });
      setContracts((prev) => [...prev, added]);
      setModalOpen(false);
      setStartDate(''); setEndDate(''); setRentAmount(''); setAdvance(''); setGuarantee(''); setTenantId(''); setDepartmentId('');
    } catch {
      setError('Error al crear contrato');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReceipt = async () => {
    if (!selectedContract) return;
    setModalLoading(true);
    try {
      const data = await apiFetch<GeneratedReceipt>(
        `/contract/${selectedContract.id}/receipt?month=${receiptMonth}&year=${receiptYear}`,
      );
      setReceipt(data);
    } catch {
      setError('Error al generar recibo');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCalculateSettlement = async () => {
    if (!selectedContract) return;
    setModalLoading(true);
    try {
      const data = await apiFetch<SettlementResult>(
        `/contract/${selectedContract.id}/settlement?actualEndDate=${actualEndDate}`,
      );
      setSettlement(data);
    } catch {
      setError('Error al calcular liquidacion');
    } finally {
      setModalLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) return <Spinner />;

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all text-sm";
  const btnCls = "w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors";

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={FileText}
        title="Contratos"
        subtitle={`${contracts.length} contratos activos`}
        onAdd={() => setModalOpen(true)}
        addLabel="Nuevo Contrato"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {contracts.length === 0 ? (
        <EmptyState icon={FileText} title="Sin contratos" description="Crea un contrato asociando inquilinos con departamentos." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {contracts.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                  Contrato #{c.id}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900">{c.tenant?.name}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{c.department?.name} - {c.department?.property?.name}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Calendar size={14} className="text-slate-400" />
                  {formatDate(c.startDate)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Calendar size={14} className="text-slate-400" />
                  {formatDate(c.endDate)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <DollarSign size={14} className="text-slate-400" />
                  S/ {c.rentAmount.toFixed(2)}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <DollarSign size={14} className="text-slate-400" />
                  Garantia: S/ {c.guaranteeDeposit.toFixed(2)}
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => { setSelectedContract(c); setReceipt(null); setReceiptModal(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Receipt size={15} /> Recibo
                </button>
                <button
                  onClick={() => { setSelectedContract(c); setSettlement(null); setSettlementModal(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Scale size={15} /> Liquidacion
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Contract Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Contrato">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Renta Mensual</label>
            <input type="number" step="0.01" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="1500.00" required className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Adelanto</label>
              <input type="number" step="0.01" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Garantia</label>
              <input type="number" step="0.01" value={guarantee} onChange={(e) => setGuarantee(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Inquilino</label>
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar...</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} - {d.property?.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting} className={btnCls}>
            {submitting ? 'Guardando...' : 'Crear Contrato'}
          </button>
        </form>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={receiptModal} onClose={() => setReceiptModal(false)} title={`Recibo - Contrato #${selectedContract?.id}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
              <input type="number" min="1" max="12" value={receiptMonth} onChange={(e) => setReceiptMonth(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Anio</label>
              <input type="number" value={receiptYear} onChange={(e) => setReceiptYear(e.target.value)} className={inputCls} />
            </div>
          </div>
          <button onClick={handleGenerateReceipt} disabled={modalLoading} className={btnCls}>
            {modalLoading ? 'Generando...' : 'Generar Recibo'}
          </button>
          {receipt && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
              <div className="text-sm font-semibold text-slate-900">Periodo: {receipt.period}</div>
              <div className="text-sm text-slate-600">{receipt.tenantName} - {receipt.departmentName}</div>
              {receipt.items.length > 0 && (
                <div className="space-y-1">
                  {receipt.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-600">{item.description}</span>
                      <span className="font-medium">S/ {item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total a pagar</span>
                  <span className="font-semibold">S/ {receipt.totalDue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Pagos realizados</span>
                  <span className="font-medium text-emerald-600">S/ {receipt.totalPayments.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Balance</span>
                  <span className={receipt.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    S/ {receipt.balance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Settlement Modal */}
      <Modal isOpen={settlementModal} onClose={() => setSettlementModal(false)} title={`Liquidacion - Contrato #${selectedContract?.id}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha real de fin</label>
            <input type="date" value={actualEndDate} onChange={(e) => setActualEndDate(e.target.value)} className={inputCls} />
          </div>
          <button onClick={handleCalculateSettlement} disabled={modalLoading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-xl transition-colors">
            {modalLoading ? 'Calculando...' : 'Calcular Liquidacion'}
          </button>
          {settlement && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
              <div className="text-sm font-semibold text-slate-900">{settlement.tenantName} - {settlement.departmentName}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total cargos</span>
                  <span className="font-medium">S/ {settlement.totalCharges.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total pagos</span>
                  <span className="font-medium text-emerald-600">S/ {settlement.totalPayments.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Deduccion garantia</span>
                  <span className="font-medium">S/ {settlement.guaranteeDeduction.toFixed(2)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-sm font-bold">
                  <span>Balance Final</span>
                  <span className={settlement.finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    S/ {settlement.finalBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
