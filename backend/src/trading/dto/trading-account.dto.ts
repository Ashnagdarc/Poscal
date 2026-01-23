import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradingAccountDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  account_name: string;

  @IsString()
  @IsNotEmpty()
  account_currency: string;

  @Type(() => Number)
  @IsNotEmpty()
  initial_balance: number;

  @Type(() => Number)
  @IsNotEmpty()
  current_balance: number;

  @IsString()
  @IsOptional()
  broker?: string;

  @IsString()
  @IsOptional()
  account_type?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateTradingAccountDto {
  @IsString()
  @IsOptional()
  account_name?: string;

  @Type(() => Number)
  @IsOptional()
  current_balance?: number;

  @IsString()
  @IsOptional()
  broker?: string;

  @IsString()
  @IsOptional()
  account_type?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
