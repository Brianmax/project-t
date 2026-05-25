import { Module } from '@nestjs/common';
import { S3ReceiptStorage } from './s3-receipt-storage';
import { RECEIPT_STORAGE } from './receipt-storage.interface';

@Module({
  providers: [
    S3ReceiptStorage,
    {
      provide: RECEIPT_STORAGE,
      useExisting: S3ReceiptStorage,
    },
  ],
  exports: [RECEIPT_STORAGE],
})
export class StorageModule {}
