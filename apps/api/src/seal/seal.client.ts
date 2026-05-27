import { Logger } from '@nestjs/common';
import { SealConfigValues } from './seal.config';
import { SealSession } from './seal.session';
import { parseSupplyDetail, isLoginPage } from './seal.parser';
import {
  SealSessionExpiredError,
  SealSupplyNotFoundError,
} from './seal.errors';
import { SupplyDetail } from './seal.types';

export class SealClient {
  private readonly logger = new Logger(SealClient.name);

  constructor(
    private readonly config: SealConfigValues,
    private readonly session: SealSession,
  ) {}

  async getSupplyDetail(
    supplyCode: string,
    branchCode = '1',
  ): Promise<SupplyDetail> {
    return this.withRetry(async (cookie) => {
      const url = `${this.config.baseUrl}/Suministros/Detalle?strCodigoSuministro=${supplyCode}&strCodigoSucursal=${branchCode}`;
      this.logger.log({
        operation: 'seal.client.getSupplyDetail',
        supplyCode,
        branchCode,
      });

      const resp = await fetch(url, {
        headers: { Cookie: `ASP.NET_SessionId=${cookie}` },
      });

      const html = await resp.text();

      if (isLoginPage(html)) {
        throw new SealSessionExpiredError(
          'SEAL returned login page instead of supply detail',
        );
      }

      const parsed = parseSupplyDetail(html);
      if (parsed.receipts.length === 0 && parsed.consumption.length === 0) {
        throw new SealSupplyNotFoundError(supplyCode);
      }

      return {
        supplyCode,
        branchCode,
        fetchedAt: new Date(),
        receipts: parsed.receipts,
        consumption: parsed.consumption,
      };
    });
  }

  async downloadInvoicePdf(
    periodoComercial: string,
    comprobanteCode: string,
  ): Promise<Buffer> {
    return this.withRetry(async (cookie) => {
      const url = `${this.config.baseUrl}/Suministros/Duplicado?CodigoPeriodoComercial=${periodoComercial}&CodigoComprobante=${comprobanteCode}`;
      this.logger.log({
        operation: 'seal.client.downloadInvoicePdf',
        periodoComercial,
        comprobanteCode,
      });

      const resp = await fetch(url, {
        headers: { Cookie: `ASP.NET_SessionId=${cookie}` },
      });

      if (resp.headers.get('content-type')?.includes('text/html')) {
        throw new SealSessionExpiredError(
          'SEAL returned HTML instead of PDF — session likely expired',
        );
      }

      const arrayBuf = await resp.arrayBuffer();
      return Buffer.from(arrayBuf);
    });
  }

  private async withRetry<T>(fn: (cookie: string) => Promise<T>): Promise<T> {
    try {
      const cookie = await this.session.getCookie();
      return await fn(cookie);
    } catch (err) {
      if (err instanceof SealSessionExpiredError) {
        this.logger.warn({
          operation: 'seal.client.retry',
          reason: 'session expired',
        });
        this.session.invalidate();
        const cookie = await this.session.getCookie();
        return await fn(cookie);
      }
      throw err;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getSupplyDetailWithDelay(
    supplyCode: string,
    branchCode = '1',
  ): Promise<SupplyDetail> {
    await this.delay(this.config.requestIntervalMs);
    return this.getSupplyDetail(supplyCode, branchCode);
  }

  async downloadInvoicePdfWithDelay(
    periodoComercial: string,
    comprobanteCode: string,
  ): Promise<Buffer> {
    await this.delay(this.config.requestIntervalMs);
    return this.downloadInvoicePdf(periodoComercial, comprobanteCode);
  }
}
