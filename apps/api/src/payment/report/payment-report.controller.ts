import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentReportService } from './payment-report.service';
import { PaymentReportQueryDto } from './dto/payment-report-query.dto';
import { PaymentReportRenderer } from './payment-report.renderer';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/decorators/current-user.decorator';

@Controller('contracts/:contractId/payments/report')
export class PaymentReportController {
  constructor(
    private readonly reportService: PaymentReportService,
    private readonly renderer: PaymentReportRenderer,
  ) {}

  @Get()
  async getJson(
    @Param('contractId') contractId: string,
    @Query() query: PaymentReportQueryDto,
  ) {
    this.validateDateRange(query);
    const data = await this.reportService.buildReport({
      contractId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      method: query.method,
    });
    return data;
  }

  @Get('pdf')
  async getPdf(
    @Param('contractId') contractId: string,
    @Query() query: PaymentReportQueryDto,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    this.validateDateRange(query);
    const data = await this.reportService.buildReport({
      contractId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      method: query.method,
    });

    const generatedAt = new Date();
    const operatorName = user?.email ?? '';
    const shortId = contractId.replace(/-/g, '').slice(0, 6);
    const fromPart = query.from ?? 'inicio';
    const toPart = query.to ?? 'hoy';
    const filename = `reporte-pagos-${shortId}-${fromPart}-${toPart}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = this.renderer.render(data, generatedAt, operatorName);
    stream.pipe(res);
  }

  private validateDateRange(query: PaymentReportQueryDto): void {
    if (query.from && query.to) {
      const from = new Date(query.from);
      const to = new Date(query.to);
      if (to < from) {
        throw new BadRequestException({
          code: 'INVALID_DATE_RANGE',
          message: '`to` must be >= `from`',
        });
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (to.getTime() > today.getTime()) {
        throw new BadRequestException({
          code: 'INVALID_DATE_RANGE',
          message: '`to` cannot be in the future',
        });
      }
    }
  }
}
