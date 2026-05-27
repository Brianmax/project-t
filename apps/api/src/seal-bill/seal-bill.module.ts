import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SealBill } from './entities/seal-bill.entity';
import { SealBillService } from './seal-bill.service';

@Module({
  imports: [TypeOrmModule.forFeature([SealBill])],
  providers: [SealBillService],
  exports: [SealBillService],
})
export class SealBillModule {}
