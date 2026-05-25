import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptEntity } from '../entities/receipt.entity';
import { ReceiptPdfController } from './receipt-pdf.controller';
import { ReceiptPdfRenderer } from './receipt-pdf.renderer';
import { ReceiptPdfService } from './receipt-pdf.service';
import { ReceiptPdfWorker } from './receipt-pdf.worker';
import { ReceiptPdfFeatureGuard } from './feature-flag.guard';
import { StorageModule } from '../../storage/storage.module';
import { QueueModule } from '../../queue/queue.module';

/**
 * Receipt PDF generation feature module.
 *
 * The worker (which subscribes to Redis on registration) is conditionally
 * loaded based on the RECEIPT_PDF_ENABLED env var. Renderer, service, and
 * controller are always registered; the controller's guard returns 404
 * FEATURE_DISABLED when the flag is off.
 */
@Module({})
export class ReceiptPdfModule {
  static forRoot(): DynamicModule {
    const featureEnabled = process.env.RECEIPT_PDF_ENABLED === 'true';
    return {
      module: ReceiptPdfModule,
      imports: [
        TypeOrmModule.forFeature([ReceiptEntity]),
        StorageModule,
        QueueModule,
      ],
      controllers: [ReceiptPdfController],
      providers: [
        ReceiptPdfRenderer,
        ReceiptPdfService,
        ReceiptPdfFeatureGuard,
        ...(featureEnabled ? [ReceiptPdfWorker] : []),
      ],
      exports: [ReceiptPdfService],
    };
  }
}
