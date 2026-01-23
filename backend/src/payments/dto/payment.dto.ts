import { IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @Type(() => Number)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsIn(['pending', 'success', 'failed', 'cancelled'])
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @IsString()
  @IsOptional()
  subscription_plan?: string;

  @IsOptional()
  metadata?: any;
}

export class UpdatePaymentDto {
  @IsIn(['pending', 'success', 'failed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  subscription_plan?: string;

  @IsOptional()
  subscription_start?: Date;

  @IsOptional()
  subscription_end?: Date;

  @IsOptional()
  metadata?: any;
}

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  reference: string;
}
