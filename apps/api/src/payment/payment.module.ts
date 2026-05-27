import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';
import { ContractModule } from '../contract/contract.module';
import { PaymentReportController } from './report/payment-report.controller';
import { PaymentReportService } from './report/payment-report.service';
import { PaymentReportRenderer } from './report/payment-report.renderer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Contract, ReceiptEntity]),
    ContractModule,
  ],
  controllers: [PaymentController, PaymentReportController],
  providers: [PaymentService, PaymentReportService, PaymentReportRenderer],
  exports: [PaymentService],
})
export class PaymentModule {}
