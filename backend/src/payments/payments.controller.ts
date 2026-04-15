import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { RevenuecatService } from '../revenuecat/revenuecat.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private revenuecatService: RevenuecatService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Request() req: any) {
    return await this.paymentsService.findAll(req.user.userId);
  }

  @Get('subscription')
  @UseGuards(AuthGuard('jwt'))
  async getActiveSubscription(@Request() req: any): Promise<SubscriptionResponseDto> {
    return await this.paymentsService.getActiveSubscription(req.user.userId);
  }

  @Get('entitlements')
  @UseGuards(AuthGuard('jwt'))
  async getEntitlements(@Request() req: any): Promise<any> {
    const userId = req.user.userId;
    // For now, use userId as RevenueCat app_user_id
    // In production, fetch from user.revenue_cat_user_id
    return await this.revenuecatService.getUserEntitlements(userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    createPaymentDto.user_id = req.user.userId;
    return await this.paymentsService.create(createPaymentDto);
  }

  @Post('restore')
  @UseGuards(AuthGuard('jwt'))
  async restorePurchase(@Request() req: any) {
    return await this.paymentsService.restorePurchase(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    return await this.paymentsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return await this.paymentsService.update(id, updatePaymentDto);
  }
}
