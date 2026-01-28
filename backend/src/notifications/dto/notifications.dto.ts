import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dh_key: string;

  @IsString()
  @IsNotEmpty()
  auth_key: string;
}

export class CreatePushNotificationDto {
  @IsString()
  @IsOptional()
  user_id?: string; // Optional: if not provided, broadcast to all users

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsOptional()
  data?: any;

  @IsOptional()
  scheduled_for?: Date;

  @IsString()
  @IsOptional()
  tag?: string; // For grouping/deduplication
}

export class CreateEmailDto {
  @IsString()
  @IsNotEmpty()
  to_email: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html_content: string;

  @IsString()
  @IsOptional()
  text_content?: string;

  @IsOptional()
  scheduled_for?: Date;
}
