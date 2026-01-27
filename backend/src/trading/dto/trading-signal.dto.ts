import { IsIn, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSignalDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsIn(['long', 'short', 'buy', 'sell'])
  @IsNotEmpty()
  direction: string;

  @Type(() => Number)
  @IsNotEmpty()
  entry_price: number;

  @Type(() => Number)
  @IsNotEmpty()
  stop_loss: number;

  @Type(() => Number)
  @IsNotEmpty()
  take_profit: number;

  @IsString()
  @IsOptional()
  analysis?: string;

  @IsString()
  @IsOptional()
  timeframe?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @Type(() => Number)
  @IsOptional()
  confidence_score?: number;
}

export class UpdateSignalDto {
  @IsString()
  @IsOptional()
  symbol?: string;

  @IsIn(['long', 'short', 'buy', 'sell'])
  @IsOptional()
  direction?: string;

  @Type(() => Number)
  @IsOptional()
  entry_price?: number;

  @Type(() => Number)
  @IsOptional()
  stop_loss?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit?: number;

  @IsString()
  @IsOptional()
  analysis?: string;

  @IsString()
  @IsOptional()
  timeframe?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsIn(['active', 'closed', 'expired', 'cancelled'])
  @IsOptional()
  status?: string;

  @Type(() => Number)
  @IsOptional()
  confidence_score?: number;
}

