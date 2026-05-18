import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    if (!roles.includes(request.user?.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
