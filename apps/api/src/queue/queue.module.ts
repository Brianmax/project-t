import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RECEIPT_PDF_QUEUE } from './queue.constants';
import { assertQueueConfig } from './queue-config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST');
        const port = Number(config.get<string>('REDIS_PORT') ?? '6379');
        const featureEnabled =
          config.get<string>('RECEIPT_PDF_ENABLED') === 'true';
        assertQueueConfig(featureEnabled, host);
        return {
          connection: {
            host: host ?? 'localhost',
            port,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: RECEIPT_PDF_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
