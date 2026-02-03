import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
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
  platform: string;

  @Type(() => Number)
  @IsNumber()
  initial_balance: number;

  @Type(() => Number)
  @IsNumber()
  current_balance: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateTradingAccountDto {
  @IsString()
  @IsOptional()
  account_name?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  initial_balance?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  current_balance?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
