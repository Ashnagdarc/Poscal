import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto, VerifyPaymentFromVercelDto } from './dto/payment.dto';
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
  async verifyFromVercel(
    @Body() verifyPaymentDto: VerifyPaymentFromVercelDto,
    @Headers('authorization') auth?: string,
  ) {
    // Check for service token from Vercel
    const serviceToken = process.env.BACKEND_SERVICE_TOKEN;
    const providedToken = auth?.replace('Bearer ', '');

    if (!serviceToken || providedToken !== serviceToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    return await this.paymentsService.createOrUpdatePaymentFromVercel(verifyPaymentDto);
  }

  @Post('restore')
  @UseGuards(AuthGuard('jwt'))
  async restorePurchase(@Request() req: any) {
    return await this.paymentsService.restorePurchase(req.user.userId);
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
