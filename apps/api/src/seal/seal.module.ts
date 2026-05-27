import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SealModuleConfig } from './seal.module-config';
import { SealClient } from './seal.client';
import { SealSyncService } from './seal-sync.service';
import { SealSyncProcessor } from './seal-sync.processor';
import { SealController } from './seal.controller';
import { Property } from '../property/entities/property.entity';
import { SealBill } from '../seal-bill/entities/seal-bill.entity';
import { SealBillModule } from '../seal-bill/seal-bill.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, SealBill]),
    SealBillModule,
    StorageModule,
    QueueModule,
  ],
  controllers: [SealController],
  providers: [
    SealModuleConfig,
    {
      provide: SealClient,
      useFactory(cfg: SealModuleConfig) {
        return cfg.client;
      },
      inject: [SealModuleConfig],
    },
    SealSyncService,
    SealSyncProcessor,
  ],
  exports: [SealClient, SealSyncService, SealModuleConfig],
})
export class SealModule {}
