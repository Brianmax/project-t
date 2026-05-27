import { PaymentMethod } from '../entities/payment.entity';

export interface PaymentReportRow {
  id: string;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  receiptPeriod: string | null;
  description: string | null;
  amount: number;
}

export interface PaymentReportTotals {
  gross: number;
  byMethod: Record<PaymentMethod, number>;
  refunds: number;
  receivedNet: number;
}

export interface PaymentReportHeader {
  contractId: string;
  tenantName: string;
  departmentName: string;
  propertyAddress: string;
  contractStart: string;
  contractEnd: string | null;
}

export interface PaymentReportData {
  header: PaymentReportHeader;
  filters: {
    from: string | null;
    to: string | null;
    method: PaymentMethod | null;
  };
  rows: PaymentReportRow[];
  totals: PaymentReportTotals;
}
