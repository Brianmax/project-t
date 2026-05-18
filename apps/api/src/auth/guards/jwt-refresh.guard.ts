import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../decorators/current-user.decorator';

export interface RefreshRequest extends Request {
  user: JwtPayload & { rawToken: string };
}

@Injectable()
export class JwtRefreshGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RefreshRequest>();
    const rawToken = (request.cookies as Record<string, string>)[
      'refreshToken'
    ];
    if (!rawToken) throw new UnauthorizedException();

    try {
      const payload = this.jwtService.verify<JwtPayload>(rawToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      request.user = { ...payload, rawToken };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
