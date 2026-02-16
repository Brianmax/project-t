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
} from '@nestjs/common';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ReceiptService, Receipt } from '../receipt/receipt.service';
import { UpdateReceiptStatusDto } from './dto/update-receipt-status.dto';
import {
  ContractSettlementService,
  SettlementResult,
} from '../contract-settlement/contract-settlement.service';

@Controller('contract')
export class ContractController {
  constructor(
    private readonly contractService: ContractService,
    private readonly receiptService: ReceiptService,
    private readonly contractSettlementService: ContractSettlementService,
  ) {}

  @Post()
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractService.create(createContractDto);
  }

  @Get()
  findAll() {
    return this.contractService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    return this.contractService.update(+id, updateContractDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contractService.remove(+id);
  }

  @Get(':id/receipt')
  previewReceipt(
    @Param('id', ParseIntPipe) contractId: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ): Promise<Receipt> {
    return this.receiptService.previewReceipt(contractId, month, year);
  }

  @Post(':id/receipt')
  issueReceipt(
    @Param('id', ParseIntPipe) contractId: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ): Promise<Receipt> {
    return this.receiptService.issueReceipt(contractId, month, year);
  }

  @Patch(':id/receipt/status')
  updateReceiptStatus(
    @Param('id', ParseIntPipe) contractId: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Body() updateReceiptStatusDto: UpdateReceiptStatusDto,
  ): Promise<Receipt> {
    return this.receiptService.updateReceiptStatus(
      contractId,
      month,
      year,
      updateReceiptStatusDto.status,
    );
  }

  @Get(':id/settlement')
  calculateSettlement(
    @Param('id', ParseIntPipe) contractId: number,
    @Query('actualEndDate') actualEndDate: string,
  ): Promise<SettlementResult> {
    return this.contractSettlementService.calculateFinalSettlement(
      contractId,
      new Date(actualEndDate),
    );
  }
}
