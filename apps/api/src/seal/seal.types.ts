export interface ParsedLoginTokens {
  sessionCookie: string;
  csrfCookie: string;
  csrfFormToken: string;
}

export interface ParsedReceiptRow {
  periodoComercial: string;
  comprobanteCode: string;
  status: 'paid' | 'pending' | 'carry_forward';
  paymentDate: string | null;
  dueDate: string;
  amountPen: string;
}

export interface ParsedConsumptionRow {
  periodoComercial: string;
  kwh: number;
}

export interface ParsedSupplyDetail {
  receipts: ParsedReceiptRow[];
  consumption: ParsedConsumptionRow[];
}

export interface SupplyReceipt {
  periodoComercial: string;
  comprobanteCode: string;
  status: 'paid' | 'pending' | 'carry_forward';
  paymentDate: string | null;
  dueDate: string;
  amountPen: string;
}

export interface SupplyConsumption {
  periodoComercial: string;
  kwh: number;
}

export interface SupplyDetail {
  supplyCode: string;
  branchCode: string;
  fetchedAt: Date;
  receipts: SupplyReceipt[];
  consumption: SupplyConsumption[];
}
