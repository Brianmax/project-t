import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ReceiptService, Receipt } from '../receipt/receipt.service';
import { UpdateReceiptStatusDto } from './dto/update-receipt-status.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';
import {
  ContractSettlementService,
  SettlementResult,
} from '../contract-settlement/contract-settlement.service';
import {
  ContractTerminationService,
  TerminationResult,
} from '../contract-termination/contract-termination.service';
import { CreateContractTerminationDto } from '../contract-termination/dto/create-contract-termination.dto';

@Controller('contracts')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly receiptService: ReceiptService,
    private readonly contractSettlementService: ContractSettlementService,
    private readonly contractTerminationService: ContractTerminationService,
  ) {}

  @Get('receipts/unpaid')
  findUnpaidReceipts(): Promise<Receipt[]> {
    return this.receiptService.findUnpaidReceipts();
  }

  @Post()
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractService.create(createContractDto);
  }

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.contractService.findAll(tenantId, departmentId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    return this.contractService.update(id, updateContractDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contractService.remove(id);
  }

  @Get(':id/receipts/months')
  listReceiptMonths(
    @Param('id') contractId: string,
  ): Promise<Array<{ month: number; year: number; status: string }>> {
    return this.receiptService.findReceiptMonthsByContract(contractId);
  }

  @Get(':id/receipts')
  previewReceipt(
    @Param('id') contractId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('startDay', new ParseIntPipe({ optional: true })) startDay?: number,
    @Query('endDay', new ParseIntPipe({ optional: true })) endDay?: number,
    @Query('prorateRent', new ParseBoolPipe({ optional: true }))
    prorateRent?: boolean,
  ): Promise<Receipt> {
    return this.receiptService.previewReceipt(
      contractId,
      month,
      year,
      startDay,
      endDay,
      prorateRent,
    );
  }

  @Post(':id/receipts')
  issueReceipt(
    @Param('id') contractId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('startDay', new ParseIntPipe({ optional: true })) startDay?: number,
    @Query('endDay', new ParseIntPipe({ optional: true })) endDay?: number,
    @Query('prorateRent', new ParseBoolPipe({ optional: true }))
    prorateRent?: boolean,
  ): Promise<Receipt> {
    return this.receiptService.issueReceipt(
      contractId,
      month,
      year,
      startDay,
      endDay,
      prorateRent,
    );
  }

  @Patch(':id/receipts/status')
  updateReceiptStatus(
    @Param('id') contractId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Body() updateReceiptStatusDto: UpdateReceiptStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Receipt> {
    return this.receiptService.updateReceiptStatus(
      contractId,
      month,
      year,
      updateReceiptStatusDto.status,
      user.sub,
    );
  }

  @Get(':id/settlement')
  calculateSettlement(
    @Param('id') contractId: string,
    @Query('actualEndDate') actualEndDate: string,
  ): Promise<SettlementResult> {
    return this.contractSettlementService.calculateFinalSettlement(
      contractId,
      new Date(actualEndDate),
    );
  }

  @Post(':id/termination')
  terminateContract(
    @Param('id') contractId: string,
    @Body() dto: CreateContractTerminationDto,
  ): Promise<TerminationResult> {
    return this.contractTerminationService.terminate(contractId, dto);
  }

  @Get(':id/termination')
  getTermination(
    @Param('id') contractId: string,
  ): Promise<TerminationResult | null> {
    return this.contractTerminationService.findByContract(contractId);
  }
}
