import { FileText } from 'lucide-react';
import type { SealBill } from '../../types/seal';
import {
  tableContainerCls,
  tableHeaderCls,
  tableHeaderCellCls,
  tableRowCls,
  tableCellCls,
} from '../../lib/styles';

interface SealBillsTableProps {
  bills: SealBill[];
  propertyId: string;
  apiBase: string;
  accessToken: string | null;
}

function formatPeriodo(pc: string): string {
  const meses = [
    '',
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const year = pc.slice(0, 4);
  const month = parseInt(pc.slice(4, 6), 10);
  return `${meses[month] ?? ''}-${year}`;
}

function statusLabel(status: SealBill['status']): {
  text: string;
  cls: string;
} {
  switch (status) {
    case 'paid':
      return {
        text: 'Pagado',
        cls:
          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/50 dark:ring-emerald-700/40',
      };
    case 'pending':
      return {
        text: 'Pendiente',
        cls:
          'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-700/40',
      };
    case 'carry_forward':
      return {
        text: 'Acumulado',
        cls:
          'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/50 dark:ring-blue-700/40',
      };
  }
}

export default function SealBillsTable({
  bills,
  propertyId,
  apiBase,
  accessToken,
}: SealBillsTableProps) {
  if (bills.length === 0) {
    return (
      <p className="text-sm text-on-surface-muted py-4">
        No hay recibos sincronizados.
      </p>
    );
  }

  const openPdf = (billId: string) => {
    const url = `${apiBase}/properties/${propertyId}/seal/bills/${billId}/pdf`;
    const w = window.open('', '_blank');
    if (w && accessToken) {
      w.document.write(`
        <html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666">
        <p>Redirigiendo al PDF...</p></body></html>
      `);
      fetch(url, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: 'follow',
      })
        .then((res) => {
          if (res.ok && res.url) {
            w.location.href = res.url;
          } else {
            w.document.write(
              '<p style="color:red">Error al cargar el PDF.</p>',
            );
          }
        })
        .catch(() => {
          w.document.write(
            '<p style="color:red">Error al cargar el PDF.</p>',
          );
        });
    }
  };

  return (
    <div className={tableContainerCls}>
      <table className="w-full text-sm">
        <thead>
          <tr className={tableHeaderCls}>
            <th className={tableHeaderCellCls}>Periodo</th>
            <th className={tableHeaderCellCls}>Vence</th>
            <th className={tableHeaderCellCls}>Estado</th>
            <th className="text-right px-4 md:px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider whitespace-nowrap">
              kWh
            </th>
            <th className="text-right px-4 md:px-5 py-3 text-[13px] font-semibold text-on-surface-medium uppercase tracking-wider whitespace-nowrap">
              Monto S/.
            </th>
            <th className={tableHeaderCellCls}>PDF</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const st = statusLabel(bill.status);
            return (
              <tr key={bill.id} className={tableRowCls}>
                <td className={`${tableCellCls} font-medium text-on-surface`}>
                  {formatPeriodo(bill.periodoComercial)}
                </td>
                <td className={`${tableCellCls} text-on-surface-medium`}>
                  {bill.dueDate.slice(0, 10)}
                </td>
                <td className={tableCellCls}>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}
                  >
                    {st.text}
                  </span>
                </td>
                <td className={`${tableCellCls} text-right text-on-surface-medium`}>
                  {bill.kwh}
                </td>
                <td className={`${tableCellCls} text-right font-medium text-on-surface`}>
                  S/ {Number(bill.amountPen).toFixed(2)}
                </td>
                <td className={tableCellCls}>
                  {bill.pdfStorageKey ? (
                    <button
                      onClick={() => openPdf(bill.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-400 dark:hover:bg-primary-900/40 rounded-lg transition-all duration-150"
                      title="Ver PDF"
                    >
                      <FileText size={14} />
                    </button>
                  ) : (
                    <span className="text-on-surface-faint text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
