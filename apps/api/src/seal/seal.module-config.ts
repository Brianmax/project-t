import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SealConfigValues, loadSealConfig } from './seal.config';
import { SealSession } from './seal.session';
import { SealClient } from './seal.client';

@Injectable()
export class SealModuleConfig {
  private readonly logger = new Logger('SealModule');
  readonly config: SealConfigValues;
  readonly session: SealSession;
  readonly client: SealClient;

  constructor(private readonly configService: ConfigService) {
    this.config = loadSealConfig({
      SEAL_BASE_URL: this.configService.get('SEAL_BASE_URL'),
      SEAL_EMAIL: this.configService.get('SEAL_EMAIL'),
      SEAL_PASSWORD: this.configService.get('SEAL_PASSWORD'),
      SEAL_SESSION_TTL_MS: this.configService.get('SEAL_SESSION_TTL_MS'),
      SEAL_REQUEST_INTERVAL_MS: this.configService.get(
        'SEAL_REQUEST_INTERVAL_MS',
      ),
    });

    this.session = new SealSession(this.config);
    this.client = new SealClient(this.config, this.session);

    this.logger.log({
      operation: 'seal.config.loaded',
      baseUrl: this.config.baseUrl,
      email: this.config.email,
      password: '[REDACTED]',
    });
  }
}
