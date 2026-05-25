import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.create(createPaymentDto, user?.sub ?? null);
  }

  @Get()
  findAll(
    @Query('contractId') contractId?: string,
    @Query('receiptId') receiptId?: string,
  ) {
    if (receiptId) {
      return this.paymentService.findByReceipt(receiptId);
    }
    if (contractId) {
      return this.paymentService.findByContract(contractId);
    }
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.update(id, updatePaymentDto, user?.sub ?? null);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.paymentService.remove(id, user?.sub ?? null);
  }
}
