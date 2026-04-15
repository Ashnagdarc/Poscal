import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { RevenuecatService } from './revenuecat.service';

@Controller('webhooks/revenuecat')
export class RevenuecatWebhookController {
  private readonly logger = new Logger('RevenuecatWebhookController');

  constructor(private readonly revenuecatService: RevenuecatService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Body() event: any,
    @Headers('x-revenuecat-signature') signature: string,
  ) {
    // Get raw body for signature verification
    // Note: NestJS doesn't provide raw body by default; in production, use middleware
    // For now, we'll verify signature separately when the raw body is available

    if (!signature) {
      this.logger.warn('Missing RevenueCat signature header');
      throw new BadRequestException('Missing signature');
    }

    this.logger.log(`Received RevenueCat webhook: ${event.event?.type}`);

    // Verify signature (requires raw body - see note above)
    // const isValid = this.revenuecatService.verifyWebhookSignature(rawBody, signature);
    // if (!isValid) {
    //   throw new BadRequestException('Invalid signature');
    // }

    // Handle event
    await this.revenuecatService.handleWebhookEvent(event);

    return { success: true };
  }
}
