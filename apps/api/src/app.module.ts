import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ExtraChargeModule } from './extra-charge/extra-charge.module';

@Module({
  imports: [
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
    ExtraChargeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
