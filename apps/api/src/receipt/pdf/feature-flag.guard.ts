import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReceiptPdfFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const enabled = this.config.get<string>('RECEIPT_PDF_ENABLED') === 'true';
    if (!enabled) {
      throw new NotFoundException({
        code: 'FEATURE_DISABLED',
        message: 'Receipt PDF generation is not enabled on this instance.',
      });
    }
    return true;
  }
}
