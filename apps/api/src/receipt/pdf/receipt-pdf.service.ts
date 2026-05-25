import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptEntity } from '../entities/receipt.entity';
import { RECEIPT_PDF_QUEUE } from '../../queue/queue.constants';
import { RECEIPT_STORAGE } from '../../storage/receipt-storage.interface';
import type { ReceiptStorage } from '../../storage/receipt-storage.interface';

@Injectable()
export class ReceiptPdfService {
  private readonly logger = new Logger(ReceiptPdfService.name);

  constructor(
    @InjectQueue(RECEIPT_PDF_QUEUE) private readonly queue: Queue,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
  ) {}

  async enqueueGeneration(
    receiptId: string,
  ): Promise<{ jobId: string; pdfStatus: 'queued' }> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId },
    });
    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptId} not found`);
    }

    // If a render is already in flight for this receipt, surface the existing
    // job instead of stacking a duplicate. The DB column is the source of
    // truth — BullMQ jobs use auto-generated IDs so a deterministic key
    // can't be used to deduplicate.
    if (receipt.pdfStatus === 'queued' || receipt.pdfStatus === 'rendering') {
      return {
        jobId: receipt.pdfJobId ?? receipt.id,
        pdfStatus: 'queued',
      };
    }

    await this.receiptRepository.update(receipt.id, {
      pdfStatus: 'queued',
      pdfError: null,
    });

    const job = await this.queue.add('render', { receiptId: receipt.id });

    await this.receiptRepository.update(receipt.id, {
      pdfJobId: job.id ?? null,
    });

    this.logger.log({
      operation: 'receipt-pdf.enqueued',
      receiptId: receipt.id,
      contractId: receipt.contractId,
      jobId: job.id,
    });

    return { jobId: job.id ?? receipt.id, pdfStatus: 'queued' };
  }

  async deleteStoredPdf(receiptId: string): Promise<void> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId },
    });
    if (!receipt) return;

    if (receipt.pdfKey) {
      try {
        await this.storage.delete(receipt.pdfKey);
      } catch (err) {
        this.logger.warn({
          operation: 'receipt-pdf.delete-stored',
          receiptId: receipt.id,
          pdfKey: receipt.pdfKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.receiptRepository.update(receipt.id, {
      pdfKey: null,
      pdfGeneratedAt: null,
      pdfContentType: null,
      pdfStatus: 'idle',
      pdfError: null,
      pdfJobId: null,
    });
  }
}
