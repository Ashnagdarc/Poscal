import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Patch, Query, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CreatePushSubscriptionDto, CreatePushNotificationDto, CreateEmailDto } from './dto/notifications.dto';
import { UpdateNotificationStatusDto, NotificationStatus } from './dto/update-notification-status.dto';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private notificationsService: NotificationsService) {}

  @Get('push/subscriptions')
  @UseGuards(AuthGuard('jwt'))
  async getUserSubscriptions(@Request() req: any) {
    return await this.notificationsService.getUserSubscriptions(req.user.userId);
  }

  @Get('push/subscriptions/active')
  @UseGuards(ServiceTokenGuard)
  async getAllActiveSubscriptions() {
    return await this.notificationsService.getAllActiveSubscriptions();
  }

  @Get('push/subscriptions/user/:userId')
  @UseGuards(ServiceTokenGuard)
  async getSubscriptionsForUser(@Param('userId') userId: string) {
    return await this.notificationsService.getUserSubscriptions(userId);
  }

  @Post('push/subscribe')
  @UseGuards(AuthGuard('jwt'))
  async createSubscription(@Body() dto: CreatePushSubscriptionDto, @Request() req: any) {
    dto.user_id = req.user.userId;
    return await this.notificationsService.createSubscription(dto);
  }

  @Delete('push/subscriptions/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteSubscription(@Param('id') id: string) {
    await this.notificationsService.deleteSubscription(id);
    return { message: 'Subscription deleted successfully' };
  }

  @Get('push')
  @UseGuards(AuthGuard('jwt'))
  async getUserNotifications(@Request() req: any) {
    return await this.notificationsService.getUserNotifications(req.user.userId);
  }

  @Post('push')
  @UseGuards(AuthGuard('jwt'))
  async queuePushNotification(@Body() dto: CreatePushNotificationDto) {
    // TODO: Add admin check for sending to other users
    return await this.notificationsService.queuePushNotification(dto);
  }

  @Post('email')
  @UseGuards(AuthGuard('jwt'))
  async queueEmail(@Body() dto: CreateEmailDto) {
    // TODO: Add admin check
    return await this.notificationsService.queueEmail(dto);
  }

  @Get('push/pending')
  @UseGuards(ServiceTokenGuard)
  async getPendingPushNotifications(@Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 100;
    const pending = await this.notificationsService.getPendingPushNotifications(take);

    const now = Date.now();
    const oldestCreatedAt = pending[0]?.created_at ? new Date(pending[0].created_at).getTime() : undefined;
    const oldestAgeMs = oldestCreatedAt ? now - oldestCreatedAt : undefined;
    const targetedCount = pending.reduce((count, notification) => (notification.user_id ? count + 1 : count), 0);

    this.logger.log(
      `notifications/push/pending :: ${JSON.stringify({ limit: take, returned: pending.length, targeted: targetedCount, oldestAgeMs })}`,
    );

    return pending;
  }

  @Get('email/pending')
  @UseGuards(AuthGuard('jwt'))
  async getPendingEmails() {
    // TODO: Add admin check
    return await this.notificationsService.getPendingEmails();
  }

  @Patch('push/:id/status')
  @UseGuards(ServiceTokenGuard)
  async updateNotificationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationStatusDto,
  ) {
    return await this.notificationsService.updateNotificationStatus(id, dto);
  }

  @Post('push/batch-status')
  @UseGuards(ServiceTokenGuard)
  async batchUpdateStatus(@Body() body: { ids: string[]; status: NotificationStatus }) {
    await this.notificationsService.batchUpdateNotificationStatus(body.ids, body.status);
    return { updated: body.ids.length };
  }
}
