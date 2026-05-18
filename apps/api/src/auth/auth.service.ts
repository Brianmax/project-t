import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    await this.userService.create({ email: dto.email, password: dto.password });
    return { message: 'Account pending approval' };
  }

  async login(dto: LoginDto, res: Response): Promise<{ accessToken: string }> {
    const user = await this.userService.findByEmail(dto.email);
    const isValid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;
    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'pending') {
      throw new ForbiddenException('Your account is pending admin approval');
    }
    if (user.status === 'rejected') {
      throw new ForbiddenException('Your account has been rejected');
    }
    return this.issueTokens(user.id, user.email, user.role, res);
  }

  async refresh(
    userId: string,
    email: string,
    rawToken: string,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const user = await this.userService.findById(userId);
    if (!user?.refreshTokenHash) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(rawToken, user.refreshTokenHash);
    if (!isValid) throw new UnauthorizedException();

    return this.issueTokens(userId, email, user.role, res);
  }

  async logout(userId: string, res: Response): Promise<void> {
    await this.userService.updateRefreshTokenHash(userId, null);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const payload = { sub: userId, email, role };

    const accessExpiresIn = this.configService.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as never,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateRefreshTokenHash(userId, refreshTokenHash);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    return { accessToken };
  }
}
