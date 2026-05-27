import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../Modal';
import Dropdown from '../Dropdown';
import DatePicker from '../DatePicker';
import { inputCls, btnPrimaryCls } from '../../lib/styles';
import { downloadPaymentReportPdf } from '../../lib/api';
import { showError, showSuccess } from '../../lib/toast';

const methodOptions = [
  { value: '', label: 'Todos' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'bank_transfer', label: 'Transferencia' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'other', label: 'Otro' },
];

interface Contract {
  id: string;
  tenant: { name: string };
  department: { name: string };
}

interface PaymentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  lockedContractId?: string;
}

export default function PaymentReportModal({
  isOpen,
  onClose,
  contracts,
  lockedContractId,
}: PaymentReportModalProps) {
  const [contractId, setContractId] = useState(lockedContractId ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const dateRangeInvalid = from && to ? new Date(from) > new Date(to) : false;

  const today = new Date();
  const futureTo = to && new Date(to) > today ? true : false;

  const canSubmit = contractId && !dateRangeInvalid && !futureTo && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const query: { from?: string; to?: string; method?: string } = {};
      if (from) query.from = from;
      if (to) query.to = to;
      if (method) query.method = method;

      await downloadPaymentReportPdf(contractId, query);
      showSuccess('Reporte descargado');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('CONTRACT_NOT_FOUND')) {
        showError('Contrato no encontrado');
      } else if (msg.includes('INVALID_DATE_RANGE')) {
        showError('Rango de fechas inválido');
      } else {
        showError('Error al generar reporte');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar reporte de pagos">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
            Contrato
          </label>
          {lockedContractId ? (
            <input
              type="text"
              value={
                contracts.find((c) => c.id === lockedContractId)?.tenant
                  ?.name ?? lockedContractId
              }
              disabled
              className={`${inputCls} bg-surface-alt`}
            />
          ) : (
            <Dropdown
              value={contractId}
              onChange={setContractId}
              required
              placeholder="Seleccionar contrato..."
              options={contracts.map((c) => ({
                value: c.id,
                label: c.tenant?.name ?? '—',
                hint: c.department?.name,
              }))}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Desde (opcional)
            </label>
            <DatePicker value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
              Hasta (opcional)
            </label>
            <DatePicker value={to} onChange={setTo} />
          </div>
        </div>

        {dateRangeInvalid && (
          <p className="text-[12px] text-status-danger-600">
            La fecha "desde" no puede ser mayor que "hasta".
          </p>
        )}
        {futureTo && (
          <p className="text-[12px] text-status-danger-600">
            La fecha "hasta" no puede ser futura.
          </p>
        )}

        <div>
          <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
            Método de pago (opcional)
          </label>
          <Dropdown
            value={method}
            onChange={setMethod}
            placeholder="Todos"
            options={methodOptions}
          />
        </div>

        <button type="submit" disabled={!canSubmit} className={btnPrimaryCls}>
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Generando...
            </span>
          ) : (
            'Descargar PDF'
          )}
        </button>
      </form>
    </Modal>
  );
}
