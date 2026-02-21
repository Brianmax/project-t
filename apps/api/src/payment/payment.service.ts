import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Contract } from '../contract/entities/contract.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const contract = await this.contractRepository.findOne({
      where: { id: createPaymentDto.contractId },
    });
    if (!contract) {
      throw new BadRequestException(
        `Contract with ID "${createPaymentDto.contractId}" not found`,
      );
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      contract: contract,
    });
    return this.paymentRepository.save(payment);
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentRepository.find({ relations: ['contract'] });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['contract'],
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID "${id}" not found`);
    }
    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
  ): Promise<Payment> {
    const payment = await this.findOne(id);

    if (updatePaymentDto.contractId) {
      const contract = await this.contractRepository.findOne({
        where: { id: updatePaymentDto.contractId },
      });
      if (!contract) {
        throw new BadRequestException(
          `Contract with ID "${updatePaymentDto.contractId}" not found`,
        );
      }
      payment.contract = contract;
    }

    this.paymentRepository.merge(payment, updatePaymentDto);
    return this.paymentRepository.save(payment);
  }

  async remove(id: string): Promise<void> {
    const payment = await this.findOne(id);
    await this.paymentRepository.remove(payment);
  }
}
