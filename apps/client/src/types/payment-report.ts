export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'yape'
  | 'plin'
  | 'other';

export interface PaymentReportRow {
  id: string;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  receiptPeriod: string | null;
  description: string | null;
  amount: number;
}

export interface PaymentReportData {
  header: {
    contractId: string;
    tenantName: string;
    departmentName: string;
    propertyAddress: string;
    contractStart: string;
    contractEnd: string | null;
  };
  filters: {
    from: string | null;
    to: string | null;
    method: PaymentMethod | null;
  };
  rows: PaymentReportRow[];
  totals: {
    gross: number;
    byMethod: Record<PaymentMethod, number>;
    refunds: number;
    receivedNet: number;
  };
}
