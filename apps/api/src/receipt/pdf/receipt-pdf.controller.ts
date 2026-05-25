import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceiptEntity } from '../entities/receipt.entity';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfFeatureGuard } from './feature-flag.guard';
import { RECEIPT_STORAGE } from '../../storage/receipt-storage.interface';
import type { ReceiptStorage } from '../../storage/receipt-storage.interface';

function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 4);
}

function buildPdfFilename(receipt: ReceiptEntity): string {
  const monthPadded = String(receipt.month).padStart(2, '0');
  return `recibo-${shortId(receipt.contractId)}-${receipt.year}-${monthPadded}.pdf`;
}

@Controller('contracts/:contractId/receipts/:receiptId/pdf')
@UseGuards(ReceiptPdfFeatureGuard)
export class ReceiptPdfController {
  constructor(
    private readonly pdfService: ReceiptPdfService,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(
    @Param('contractId') contractId: string,
    @Param('receiptId') receiptId: string,
  ): Promise<{ jobId: string; pdfStatus: 'queued' }> {
    await this.assertReceiptExists(contractId, receiptId);
    return this.pdfService.enqueueGeneration(receiptId);
  }

  @Get('status')
  async status(
    @Param('contractId') contractId: string,
    @Param('receiptId') receiptId: string,
  ): Promise<{
    pdfStatus: ReceiptEntity['pdfStatus'];
    pdfGeneratedAt: string | null;
    pdfError: string | null;
  }> {
    const receipt = await this.assertReceiptExists(contractId, receiptId);
    return {
      pdfStatus: receipt.pdfStatus,
      pdfGeneratedAt: receipt.pdfGeneratedAt
        ? receipt.pdfGeneratedAt.toISOString()
        : null,
      pdfError: receipt.pdfError,
    };
  }

  /**
   * Returns a short-lived signed URL the client can navigate to in order
   * to download the PDF directly from object storage. We return JSON rather
   * than a 302 so the client can include its Bearer auth header on this
   * call (the signed URL itself is unauthenticated for its TTL window).
   */
  @Get()
  async download(
    @Param('contractId') contractId: string,
    @Param('receiptId') receiptId: string,
  ): Promise<{ url: string; filename: string }> {
    const receipt = await this.assertReceiptExists(contractId, receiptId);
    if (!receipt.pdfKey || receipt.pdfStatus !== 'ready') {
      throw new NotFoundException({
        code: 'PDF_NOT_READY',
        message: `Receipt ${receiptId} has no PDF ready yet.`,
      });
    }
    const filename = buildPdfFilename(receipt);
    const url = await this.storage.getDownloadUrl(receipt.pdfKey, { filename });
    return { url, filename };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('contractId') contractId: string,
    @Param('receiptId') receiptId: string,
  ): Promise<void> {
    await this.assertReceiptExists(contractId, receiptId);
    await this.pdfService.deleteStoredPdf(receiptId);
  }

  private async assertReceiptExists(
    contractId: string,
    receiptId: string,
  ): Promise<ReceiptEntity> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, contractId },
    });
    if (!receipt) {
      throw new NotFoundException({
        code: 'RECEIPT_NOT_FOUND',
        message: `Receipt ${receiptId} not found for contract ${contractId}.`,
      });
    }
    return receipt;
  }
}
