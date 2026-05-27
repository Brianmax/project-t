import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SealSyncService } from './seal-sync.service';
import { SEAL_SYNC_QUEUE } from '../queue/queue.constants';

export interface SealSyncJobData {
  propertyId: string;
}

export interface SealSyncJobResult {
  inserted: number;
  updated: number;
  pdfsDownloaded: number;
}

@Processor(SEAL_SYNC_QUEUE, { concurrency: 1 })
export class SealSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SealSyncProcessor.name);

  constructor(private readonly syncService: SealSyncService) {
    super();
  }

  async process(job: Job<SealSyncJobData>): Promise<SealSyncJobResult> {
    const { propertyId } = job.data;
    this.logger.log({
      operation: 'seal-sync-processor.processing',
      propertyId,
      jobId: job.id,
    });

    return this.syncService.syncProperty(propertyId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SealSyncJobData> | undefined, err: Error): void {
    if (!job?.data?.propertyId) return;

    this.logger.error({
      operation: 'seal-sync-processor.failed',
      propertyId: job.data.propertyId,
      jobId: job.id,
      error: err.message,
    });
  }
}
