import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, RefreshCw, Pencil, Link as LinkIcon } from 'lucide-react';
import { apiFetch, apiPost, apiPatch, getAccessToken } from '../../lib/api';
import { showSuccess, showError } from '../../lib/toast';
import SealLinkModal from './SealLinkModal';
import SealBillsTable from './SealBillsTable';
import type { SealBill, SealSyncStatus } from '../../types/seal';

interface SealCardProps {
  propertyId: string;
  sealSupplyCode: string | null;
  sealLastSyncedAt: string | null;
  sealLastSyncError: string | null;
  onPropertyUpdate: (p: Record<string, unknown>) => void;
}

const API_BASE = 'http://localhost:3001';

export default function SealCard({
  propertyId,
  sealSupplyCode,
  sealLastSyncedAt,
  sealLastSyncError,
  onPropertyUpdate,
}: SealCardProps) {
  const [bills, setBills] = useState<SealBill[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBills = useCallback(async () => {
    try {
      const data = await apiFetch<{ bills: SealBill[] }>(
        `/properties/${propertyId}/seal/bills`,
      );
      setBills(data.bills);
    } catch {
      /* bills will remain empty */
    }
  }, [propertyId]);

  useEffect(() => {
    if (sealSupplyCode) {
      fetchBills();
    }
  }, [sealSupplyCode, fetchBills]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollSyncStatus = useCallback(
    (jobId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await apiFetch<SealSyncStatus>(
            `/properties/${propertyId}/seal/sync/status?jobId=${jobId}`,
          );
          if (status.state === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setSyncing(false);
            await fetchBills();
            const prop = await apiFetch<Record<string, unknown>>(
              `/properties/${propertyId}`,
            );
            onPropertyUpdate(prop);
            const r = status.result;
            if (r) {
              showSuccess(
                `${r.inserted + r.updated} recibos sincronizados, ${r.pdfsDownloaded} PDF descargados`,
              );
            }
          } else if (status.state === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            setSyncing(false);
            const prop = await apiFetch<Record<string, unknown>>(
              `/properties/${propertyId}`,
            );
            onPropertyUpdate(prop);
            showError(
              status.error?.message ?? 'Error al sincronizar con SEAL',
            );
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setSyncing(false);
          showError('Error al consultar estado de sincronizacion');
        }
      }, 1000);
    },
    [propertyId, fetchBills, onPropertyUpdate],
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await apiPost<{ jobId: string }>(
        `/properties/${propertyId}/seal/sync`,
        {},
      );
      pollSyncStatus(result.jobId);
    } catch (err) {
      setSyncing(false);
      showError(
        err instanceof Error ? err.message : 'Error al iniciar sincronizacion',
      );
    }
  };

  const handleLink = async (supplyCode: string, branchCode: string) => {
    setSubmitting(true);
    try {
      const result = await apiPatch<{ property: Record<string, unknown> }>(
        `/properties/${propertyId}/seal`,
        { sealSupplyCode: supplyCode, sealBranchCode: branchCode },
      );
      onPropertyUpdate(result.property);
      setLinkModalOpen(false);
      showSuccess('Suministro vinculado exitosamente');
    } catch {
      showError('Error al vincular suministro');
    } finally {
      setSubmitting(false);
    }
  };

  const timeAgo = (iso: string | null): string => {
    if (!iso) return 'Nunca';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'hace un momento';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days}d`;
  };

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0 ring-1 ring-amber-200/50 dark:ring-amber-700/40">
            <Zap size={19} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface tracking-tight">
              Servicio Electrico SEAL
            </h3>
            {sealSupplyCode && (
              <p className="text-xs text-on-surface-muted">
                Suministro {sealSupplyCode}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sealSupplyCode ? (
            <>
              <button
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-on-surface-medium bg-surface-raised hover:bg-surface-alt rounded-lg transition-all duration-150"
                title="Editar suministro"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-surface-raised disabled:text-on-surface-faint rounded-lg transition-all duration-150"
              >
                <RefreshCw
                  size={13}
                  className={syncing ? 'animate-spin' : ''}
                />
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setLinkModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-400 rounded-lg transition-all duration-150"
            >
              <LinkIcon size={13} />
              Vincular
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!sealSupplyCode ? (
          <p className="text-sm text-on-surface-muted">
            Esta propiedad no tiene un suministro SEAL vinculado. Ingresa el
            codigo de suministro para empezar a sincronizar recibos y consumos.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-4 text-xs text-on-surface-muted mb-4">
              <span>
                Ultima sincronizacion: {timeAgo(sealLastSyncedAt)}
              </span>
              <span>{bills.length} recibos</span>
            </div>

            {sealLastSyncError && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs ring-1 ring-red-200/50 dark:ring-red-700/40">
                {sealLastSyncError}
              </div>
            )}

            <SealBillsTable
              bills={bills}
              propertyId={propertyId}
              apiBase={API_BASE}
              accessToken={getAccessToken()}
            />
          </>
        )}
      </div>

      <SealLinkModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={handleLink}
        submitting={submitting}
      />

      <SealLinkModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleLink}
        submitting={submitting}
      />
    </div>
  );
}
