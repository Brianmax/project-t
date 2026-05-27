import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../property/entities/property.entity';
import { SealBill } from '../seal-bill/entities/seal-bill.entity';
import { SealBillStatus } from '../seal-bill/entities/seal-bill-status';
import { SealClient } from './seal.client';
import { RECEIPT_STORAGE } from '../storage/receipt-storage.interface';
import type { ReceiptStorage } from '../storage/receipt-storage.interface';
import type {
  SupplyDetail,
  SupplyReceipt,
  SupplyConsumption,
} from './seal.types';

export class SealNotConfiguredError extends Error {
  constructor(propertyId: string) {
    super(`Property ${propertyId} has no SEAL supply code configured`);
    this.name = 'SealNotConfiguredError';
  }
}

export interface SyncResult {
  inserted: number;
  updated: number;
  pdfsDownloaded: number;
}

@Injectable()
export class SealSyncService {
  private readonly logger = new Logger(SealSyncService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(SealBill)
    private readonly billRepo: Repository<SealBill>,
    private readonly sealClient: SealClient,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
  ) {}

  async syncProperty(propertyId: string): Promise<SyncResult> {
    const prop = await this.propertyRepo.findOneOrFail({
      where: { id: propertyId },
    });
    if (!prop.sealSupplyCode) {
      throw new SealNotConfiguredError(propertyId);
    }

    let detail: SupplyDetail;
    try {
      detail = await this.sealClient.getSupplyDetailWithDelay(
        prop.sealSupplyCode,
        prop.sealBranchCode ?? '1',
      );
    } catch (err) {
      await this.recordSyncError(prop, err);
      throw err;
    }

    const kwhByPeriodo = this.buildKwhMap(detail.consumption);

    let inserted = 0;
    let updated = 0;
    let pdfsDownloaded = 0;

    for (const r of detail.receipts) {
      const existing = await this.billRepo.findOne({
        where: { propertyId, periodoComercial: r.periodoComercial },
      });

      const kwh = kwhByPeriodo.get(r.periodoComercial) ?? 0;
      const row = this.upsertBillRow(existing, propertyId, r, kwh);

      if (!existing) inserted++;
      else updated++;
      await this.billRepo.save(row);

      if (!row.pdfStorageKey) {
        pdfsDownloaded += await this.downloadPdf(prop, row, r);
      }
    }

    prop.sealLastSyncedAt = new Date();
    prop.sealLastSyncError = null;
    await this.propertyRepo.save(prop);

    this.logger.log({
      operation: 'seal-sync.completed',
      propertyId,
      inserted,
      updated,
      pdfsDownloaded,
    });

    return { inserted, updated, pdfsDownloaded };
  }

  private buildKwhMap(consumption: SupplyConsumption[]): Map<string, number> {
    return new Map(consumption.map((c) => [c.periodoComercial, c.kwh]));
  }

  private upsertBillRow(
    existing: SealBill | null,
    propertyId: string,
    r: SupplyReceipt,
    kwh: number,
  ): SealBill {
    const row =
      existing ??
      this.billRepo.create({
        propertyId,
        periodoComercial: r.periodoComercial,
      });

    row.comprobanteCode = r.comprobanteCode;
    row.status = r.status as SealBillStatus;
    row.paymentDate = r.paymentDate;
    row.dueDate = r.dueDate;
    row.amountPen = r.amountPen;
    row.kwh = kwh;
    return row;
  }

  private async downloadPdf(
    prop: Property,
    row: SealBill,
    r: SupplyReceipt,
  ): Promise<number> {
    try {
      const pdf = await this.sealClient.downloadInvoicePdfWithDelay(
        r.periodoComercial,
        r.comprobanteCode,
      );
      const key = `seal/${prop.id}/${r.periodoComercial}-${r.comprobanteCode}.pdf`;
      await this.storage.upload(key, pdf, 'application/pdf');
      row.pdfStorageKey = key;
      row.pdfFetchedAt = new Date();
      await this.billRepo.save(row);
      return 1;
    } catch (err) {
      this.logger.warn({
        operation: 'seal-sync.pdf-download-failed',
        propertyId: prop.id,
        periodoComercial: r.periodoComercial,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }
  }

  private async recordSyncError(prop: Property, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    prop.sealLastSyncError = message.slice(0, 500);
    await this.propertyRepo.save(prop);

    this.logger.error({
      operation: 'seal-sync.failed',
      propertyId: prop.id,
      error: message,
    });
  }
}
