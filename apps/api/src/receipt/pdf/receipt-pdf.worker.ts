import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptEntity } from '../entities/receipt.entity';
import { ReceiptPdfRenderer } from './receipt-pdf.renderer';
import { RECEIPT_PDF_QUEUE } from '../../queue/queue.constants';
import { RECEIPT_STORAGE } from '../../storage/receipt-storage.interface';
import type { ReceiptStorage } from '../../storage/receipt-storage.interface';

interface PdfJobData {
  receiptId: string;
}

@Processor(RECEIPT_PDF_QUEUE, { concurrency: 2 })
export class ReceiptPdfWorker extends WorkerHost {
  private readonly logger = new Logger(ReceiptPdfWorker.name);

  constructor(
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
    private readonly renderer: ReceiptPdfRenderer,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>): Promise<void> {
    const startedAt = Date.now();
    const { receiptId } = job.data;

    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId },
    });
    if (!receipt) {
      throw new Error(`Receipt ${receiptId} not found`);
    }

    await this.receiptRepository.update(receipt.id, {
      pdfStatus: 'rendering',
    });

    const buffer = await this.renderer.render(receipt);
    const key = `receipts/${receipt.contractId}/${receipt.id}.pdf`;
    await this.storage.upload(key, buffer, 'application/pdf');

    await this.receiptRepository.update(receipt.id, {
      pdfKey: key,
      pdfContentType: 'application/pdf',
      pdfGeneratedAt: new Date(),
      pdfStatus: 'ready',
      pdfError: null,
    });

    this.logger.log({
      operation: 'receipt-pdf.rendered',
      receiptId: receipt.id,
      contractId: receipt.contractId,
      attempt: job.attemptsMade + 1,
      duration_ms: Date.now() - startedAt,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PdfJobData> | undefined, err: Error): Promise<void> {
    if (!job?.data?.receiptId) return;

    const maxAttempts = job.opts.attempts ?? 1;
    // Only finalize on the last attempt — earlier failures will be retried.
    if (job.attemptsMade < maxAttempts) return;

    await this.receiptRepository.update(job.data.receiptId, {
      pdfStatus: 'failed',
      pdfError: err.message.slice(0, 500),
    });

    this.logger.error({
      operation: 'receipt-pdf.failed',
      receiptId: job.data.receiptId,
      attempts: job.attemptsMade,
      error: err.message,
    });
  }
}
