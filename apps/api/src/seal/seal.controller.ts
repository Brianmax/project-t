import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue, Job } from 'bullmq';
import { Property } from '../property/entities/property.entity';
import { SealBill } from '../seal-bill/entities/seal-bill.entity';
import { SealBillService } from '../seal-bill/seal-bill.service';
import { SealSyncService } from './seal-sync.service';
import { RECEIPT_STORAGE } from '../storage/receipt-storage.interface';
import type { ReceiptStorage } from '../storage/receipt-storage.interface';
import { SEAL_SYNC_QUEUE } from '../queue/queue.constants';
import {
  ConfigureSealDto,
  ListBillsQueryDto,
  SyncStatusQueryDto,
} from './dto/seal.dto';

@Controller('properties/:propertyId/seal')
export class SealController {
  private readonly logger = new Logger(SealController.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(SealBill)
    private readonly billRepo: Repository<SealBill>,
    private readonly billService: SealBillService,
    private readonly syncService: SealSyncService,
    @Inject(RECEIPT_STORAGE) private readonly storage: ReceiptStorage,
    @InjectQueue(SEAL_SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  @Patch()
  async configure(
    @Param('propertyId') propertyId: string,
    @Body() dto: ConfigureSealDto,
  ) {
    const property = await this.propertyRepo.findOneOrFail({
      where: { id: propertyId },
    });

    if (dto.sealSupplyCode === null) {
      property.sealSupplyCode = null;
      property.sealBranchCode = null;
    } else {
      const existing = await this.propertyRepo.findOne({
        where: { sealSupplyCode: dto.sealSupplyCode },
      });
      if (existing && existing.id !== propertyId) {
        throw new ConflictException({
          code: 'SEAL_SUPPLY_CONFLICT',
          message: `Supply code ${dto.sealSupplyCode} is already linked to property ${existing.id}`,
        });
      }
      property.sealSupplyCode = dto.sealSupplyCode;
      property.sealBranchCode = dto.sealBranchCode ?? '1';
    }

    await this.propertyRepo.save(property);
    return { property };
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@Param('propertyId') propertyId: string) {
    const property = await this.propertyRepo.findOneOrFail({
      where: { id: propertyId },
    });

    if (!property.sealSupplyCode) {
      throw new ConflictException({
        code: 'SEAL_NOT_CONFIGURED',
        message: `Property ${propertyId} has no SEAL supply code configured`,
      });
    }

    const activeJobs = await this.syncQueue.getActive();
    const waitingJobs = await this.syncQueue.getWaiting();
    const allJobs = [...activeJobs, ...waitingJobs];
    const existingForProperty = allJobs.find(
      (j: Job) => (j.data as { propertyId: string }).propertyId === propertyId,
    );

    if (existingForProperty) {
      throw new ConflictException({
        code: 'SEAL_SYNC_IN_PROGRESS',
        message: `A sync job is already running for property ${propertyId}`,
      });
    }

    const job = await this.syncQueue.add('sync', { propertyId });

    this.logger.log({
      operation: 'seal.sync.triggered',
      propertyId,
      jobId: job.id,
    });

    return { jobId: job.id };
  }

  @Get('sync/status')
  async syncStatus(
    @Param('propertyId') propertyId: string,
    @Query() query: SyncStatusQueryDto,
  ) {
    const job = await this.syncQueue.getJob(query.jobId);
    if (!job) {
      throw new NotFoundException({
        code: 'SEAL_JOB_NOT_FOUND',
        message: `Job ${query.jobId} not found`,
      });
    }

    const state = await job.getState();
    const result = job.returnvalue as Record<string, unknown> | undefined;
    const failedReason = job.failedReason;

    return {
      state,
      result: state === 'completed' ? result : undefined,
      error: state === 'failed' ? this.mapSyncError(failedReason) : undefined,
    };
  }

  @Get('bills')
  async listBills(
    @Param('propertyId') propertyId: string,
    @Query() query: ListBillsQueryDto,
  ) {
    await this.propertyRepo.findOneOrFail({ where: { id: propertyId } });
    const bills = await this.billService.findByProperty(
      propertyId,
      query.limit,
    );
    return { bills };
  }

  @Get('bills/:billId/pdf')
  async streamPdf(
    @Param('propertyId') propertyId: string,
    @Param('billId') billId: string,
    @Res() res: Response,
  ) {
    const bill = await this.billService.findOneByPropertyAndBillId(
      propertyId,
      billId,
    );
    if (!bill) {
      throw new NotFoundException({
        code: 'SEAL_BILL_NOT_FOUND',
        message: `Bill ${billId} not found for property ${propertyId}`,
      });
    }

    if (!bill.pdfStorageKey) {
      throw new NotFoundException({
        code: 'SEAL_PDF_NOT_FETCHED_YET',
        message: `PDF for bill ${billId} has not been fetched yet`,
      });
    }

    const url = await this.storage.getDownloadUrl(bill.pdfStorageKey, {
      filename: `Recibo-${bill.periodoComercial}.pdf`,
    });

    res.redirect(url);
  }

  private mapSyncError(reason: string | undefined): {
    code: string;
    message: string;
  } {
    if (!reason) {
      return { code: 'SEAL_SYNC_FAILED', message: 'Unknown error' };
    }

    if (reason.includes('SealAuthError') || reason.includes('SEAL_AUTH')) {
      return {
        code: 'SEAL_AUTH_FAILED',
        message: 'SEAL login failed. Credentials may have changed.',
      };
    }
    if (reason.includes('SealParseError') || reason.includes('SEAL_PARSE')) {
      return {
        code: 'SEAL_PARSE_FAILED',
        message: 'SEAL portal returned unexpected HTML structure.',
      };
    }
    if (
      reason.includes('SealSupplyNotFoundError') ||
      reason.includes('SEAL_SUPPLY_NOT_FOUND')
    ) {
      return {
        code: 'SEAL_SUPPLY_NOT_FOUND',
        message: 'SEAL did not return data for the given supply code.',
      };
    }
    if (
      reason.includes('SealNotConfiguredError') ||
      reason.includes('SEAL_NOT_CONFIGURED')
    ) {
      return {
        code: 'SEAL_NOT_CONFIGURED',
        message: 'Property has no SEAL supply code configured.',
      };
    }

    return { code: 'SEAL_SYNC_FAILED', message: reason.slice(0, 300) };
  }
}
