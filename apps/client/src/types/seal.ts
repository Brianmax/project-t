export interface SealBill {
  id: string;
  propertyId: string;
  periodoComercial: string;
  comprobanteCode: string;
  dueDate: string;
  paymentDate: string | null;
  status: 'paid' | 'pending' | 'carry_forward';
  amountPen: string;
  kwh: number;
  pdfStorageKey: string | null;
  pdfFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SealSyncStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed';
  result?: { inserted: number; updated: number; pdfsDownloaded: number };
  error?: { code: string; message: string };
}
