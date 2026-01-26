import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto, VerifyPaymentDto } from './dto/payment.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

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

  @Get('webhooks/logs')
  @UseGuards(AuthGuard('jwt'))
  async getWebhookLogs(@Query('limit') limit?: number) {
    // TODO: Add admin check
    return await this.paymentsService.getWebhookLogs(limit);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findOne(@Param('id') id: string) {
    return await this.paymentsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async create(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    createPaymentDto.user_id = req.user.userId;
    return await this.paymentsService.create(createPaymentDto);
  }

  @Post('verify')
  @UseGuards(AuthGuard('jwt'))
  async verify(@Body() verifyPaymentDto: VerifyPaymentDto) {
    return await this.paymentsService.verifyPayment(verifyPaymentDto.reference);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return await this.paymentsService.update(id, updatePaymentDto);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any) {
    // TODO: Verify Paystack signature
    const event = body.event;
    const data = body.data;

    try {
      // Handle different webhook events
      if (event === 'charge.success') {
        const payment = await this.paymentsService.findByReference(data.reference);
        if (payment) {
          await this.paymentsService.update(payment.id, {
            status: 'success',
            metadata: data,
          });
        }
      }

      await this.paymentsService.logWebhook(event, data, 'processed', undefined, data.reference);
      return { status: 'success' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.paymentsService.logWebhook(event, data, 'failed', errorMessage, data.reference);
      throw error;
    }
  }
}
