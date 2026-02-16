import { Module } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../contract/entities/contract.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ExtraCharge } from '../extra-charge/entities/extra-charge.entity';
import { ConsumptionModule } from '../consumption/consumption.module';
import { ReceiptEntity } from './entities/receipt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Payment, ExtraCharge, ReceiptEntity]),
    ConsumptionModule,
  ],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
