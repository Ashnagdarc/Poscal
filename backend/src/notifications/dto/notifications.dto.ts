import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsUUID()
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
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

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
