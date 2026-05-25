import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Contract } from '../contract/entities/contract.entity';
import { ReceiptEntity } from '../receipt/entities/receipt.entity';
import { ContractLedgerService } from '../contract/contract-ledger.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ReceiptEntity)
    private readonly receiptRepository: Repository<ReceiptEntity>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: ContractLedgerService,
  ) {}

  async create(
    dto: CreatePaymentDto,
    recordedBy: string | null,
  ): Promise<Payment> {
    this.assertNotFutureDate(dto.date);
    this.assertNonZeroAmount(dto.amount);

    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(Contract, {
        where: { id: dto.contractId },
      });
      if (!contract) {
        throw new BadRequestException({
          code: 'CONTRACT_NOT_FOUND',
          message: `Contract "${dto.contractId}" not found`,
        });
      }

      if (dto.receiptId) {
        await this.assertReceiptMatchesContract(
          manager,
          dto.receiptId,
          dto.contractId,
        );
      }

      const payment = manager.create(Payment, {
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        method: dto.method,
        reference: dto.reference ?? null,
        contractId: dto.contractId,
        receiptId: dto.receiptId ?? null,
        recordedBy,
      });
      const saved = await manager.save(payment);

      await this.ledgerService.recalculate(
        saved.contractId,
        manager,
        recordedBy,
      );

      return saved;
    });
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentRepository.find({
      relations: ['contract', 'contract.tenant', 'contract.department'],
      order: { date: 'DESC' },
    });
  }

  async findByContract(contractId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { contractId },
      order: { date: 'DESC' },
    });
  }

  async findByReceipt(receiptId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { receiptId },
      order: { date: 'DESC' },
    });
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
    dto: UpdatePaymentDto,
    recordedBy: string | null,
  ): Promise<Payment> {
    if (dto.date) this.assertNotFutureDate(dto.date);

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Payment, { where: { id } });
      if (!existing) {
        throw new NotFoundException(`Payment with ID "${id}" not found`);
      }

      // Capture before merge — manager.merge mutates `existing` in place,
      // which would clobber the old contractId we still need to recalculate.
      const previousContractId = existing.contractId;
      const nextContractId = dto.contractId ?? existing.contractId;
      const nextReceiptId =
        dto.receiptId === undefined ? existing.receiptId : dto.receiptId;

      if (dto.contractId && dto.contractId !== existing.contractId) {
        const contract = await manager.findOne(Contract, {
          where: { id: dto.contractId },
        });
        if (!contract) {
          throw new BadRequestException({
            code: 'CONTRACT_NOT_FOUND',
            message: `Contract "${dto.contractId}" not found`,
          });
        }
      }

      if (nextReceiptId) {
        await this.assertReceiptMatchesContract(
          manager,
          nextReceiptId,
          nextContractId,
        );
      }

      manager.merge(Payment, existing, {
        ...dto,
        date: dto.date ? new Date(dto.date) : existing.date,
        receiptId: nextReceiptId,
      });
      const saved = await manager.save(existing);

      const contractIdsToRecompute = new Set<string>();
      contractIdsToRecompute.add(saved.contractId);
      if (saved.contractId !== previousContractId) {
        contractIdsToRecompute.add(previousContractId);
      }

      for (const cid of contractIdsToRecompute) {
        await this.ledgerService.recalculate(cid, manager, recordedBy);
      }

      return saved;
    });
  }

  async remove(id: string, recordedBy: string | null): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, { where: { id } });
      if (!payment) {
        throw new NotFoundException(`Payment with ID "${id}" not found`);
      }

      const contractId = payment.contractId;
      await manager.remove(payment);

      await this.ledgerService.recalculate(contractId, manager, recordedBy);
    });
  }

  private assertNotFutureDate(date: string): void {
    // Bypassed in development so operators can test future-dated scenarios
    // locally. Tests run with NODE_ENV=test so the check still fires there.
    if (process.env.NODE_ENV === 'development') return;

    const target = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (target.getTime() > today.getTime()) {
      throw new BadRequestException({
        code: 'FUTURE_PAYMENT_DATE',
        message: 'Payment date cannot be in the future',
      });
    }
  }

  private assertNonZeroAmount(amount: number): void {
    if (amount === 0) {
      throw new BadRequestException({
        code: 'ZERO_AMOUNT',
        message: 'Payment amount cannot be zero',
      });
    }
  }

  private async assertReceiptMatchesContract(
    manager: EntityManager,
    receiptId: string,
    contractId: string,
  ): Promise<void> {
    const receipt = await manager.findOne(ReceiptEntity, {
      where: { id: receiptId },
    });
    if (!receipt) {
      throw new BadRequestException({
        code: 'RECEIPT_NOT_FOUND',
        message: `Receipt "${receiptId}" not found`,
      });
    }
    if (receipt.contractId !== contractId) {
      throw new BadRequestException({
        code: 'RECEIPT_CONTRACT_MISMATCH',
        message: `Receipt "${receiptId}" does not belong to contract "${contractId}"`,
      });
    }
  }
}
