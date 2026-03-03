import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Module({
  imports: [JwtModule.register({}), UserModule],
  providers: [AuthService, JwtRefreshGuard],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
