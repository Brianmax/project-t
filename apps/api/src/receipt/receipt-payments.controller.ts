import { Controller, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payment/entities/payment.entity';

@Controller('receipts/:receiptId/payments')
export class ReceiptPaymentsController {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  @Get()
  list(@Param('receiptId') receiptId: string) {
    return this.paymentRepository.find({
      where: { receiptId },
      order: { date: 'DESC' },
    });
  }
}
