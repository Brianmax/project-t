import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PropertyModule } from './property/property.module';
import { DepartmentModule } from './department/department.module';
import { TenantModule } from './tenant/tenant.module';
import { ContractModule } from './contract/contract.module';
import { DepartmentMeterModule } from './department-meter/department-meter.module';
import { PropertyMeterModule } from './property-meter/property-meter.module';
import { MeterReadingModule } from './meter-reading/meter-reading.module';
import { ConsumptionModule } from './consumption/consumption.module';
import { PaymentModule } from './payment/payment.module';
import { ReceiptModule } from './receipt/receipt.module';
import { ContractSettlementModule } from './contract-settlement/contract-settlement.module';
import { ContractTerminationModule } from './contract-termination/contract-termination.module';
import { ExtraChargeModule } from './extra-charge/extra-charge.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { SeedModule } from './seed/seed.module';
import { JwtGuard } from './auth/guards/jwt.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'password',
      database: 'property_management',
      autoLoadEntities: true,
      synchronize: true,
    }),
    PropertyModule,
    DepartmentModule,
    TenantModule,
    ContractModule,
    DepartmentMeterModule,
    PropertyMeterModule,
    MeterReadingModule,
    ConsumptionModule,
    PaymentModule,
    ReceiptModule,
    ContractSettlementModule,
    ContractTerminationModule,
    ExtraChargeModule,
    AuthModule,
    UserModule,
    AdminModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
})
export class AppModule {}
