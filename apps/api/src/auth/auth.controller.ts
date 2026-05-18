import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { RefreshRequest } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sub, email, rawToken } = req.user;
    return this.authService.refresh(sub, email, rawToken, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(user.sub, res);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
