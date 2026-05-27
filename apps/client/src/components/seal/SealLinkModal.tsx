import { useState } from 'react';
import Modal from '../Modal';
import { inputCls, btnCls } from '../../lib/styles';

interface SealLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (supplyCode: string, branchCode: string) => Promise<void>;
  submitting: boolean;
}

const BRANCHES = [
  { value: '1', label: '1 — Arequipa' },
  { value: '2', label: '2 — Lima' },
  { value: '3', label: '3 — Cusco' },
  { value: '4', label: '4 — Trujillo' },
  { value: '5', label: '5 — Piura' },
];

export default function SealLinkModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}: SealLinkModalProps) {
  const [supplyCode, setSupplyCode] = useState('');
  const [branchCode, setBranchCode] = useState('1');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplyCode) return;
    await onSubmit(supplyCode, branchCode);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vincular Suministro SEAL">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
            Codigo de Suministro
          </label>
          <input
            type="text"
            value={supplyCode}
            onChange={(e) => setSupplyCode(e.target.value)}
            placeholder="Ej: 50888"
            required
            pattern="\d{4,20}"
            title="4 a 20 digitos"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-on-surface-medium mb-1.5">
            Sucursal
          </label>
          <select
            value={branchCode}
            onChange={(e) => setBranchCode(e.target.value)}
            className={inputCls}
          >
            {BRANCHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={submitting} className={btnCls}>
          {submitting ? 'Vinculando...' : 'Vincular Suministro'}
        </button>
      </form>
    </Modal>
  );
}
