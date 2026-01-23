import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export class UpdateNotificationStatusDto {
  @IsEnum(NotificationStatus)
  status: NotificationStatus;

  @IsOptional()
  @IsString()
  sent_at?: string;

  @IsOptional()
  @IsString()
  error_message?: string;
}
