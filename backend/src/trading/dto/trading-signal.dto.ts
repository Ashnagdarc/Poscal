import { IsIn, IsNotEmpty, IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSignalDto {
  @IsString()
  @IsNotEmpty()
  currency_pair: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsIn(['buy', 'sell'])
  @IsNotEmpty()
  direction: string;

  @IsString()
  @IsOptional()
  market_execution?: string;

  @IsIn(['active', 'closed', 'cancelled'])
  @IsOptional()
  status?: string;

  @Type(() => Number)
  @IsNotEmpty()
  entry_price: number;

  @Type(() => Number)
  @IsNotEmpty()
  stop_loss: number;

  @Type(() => Number)
  @IsNotEmpty()
  take_profit_1: number;

  @Type(() => Number)
  @IsOptional()
  take_profit_2?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit_3?: number;

  @Type(() => Number)
  @IsNotEmpty()
  pips_to_sl: number;

  @Type(() => Number)
  @IsNotEmpty()
  pips_to_tp1: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_tp2?: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_tp3?: number;

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

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  chart_image_url?: string;
}

export class UpdateSignalDto {
  @IsString()
  @IsOptional()
  currency_pair?: string;

  @IsString()
  @IsOptional()
  symbol?: string;

  @IsIn(['buy', 'sell'])
  @IsOptional()
  direction?: string;

  @IsString()
  @IsOptional()
  market_execution?: string;

  @Type(() => Number)
  @IsOptional()
  entry_price?: number;

  @Type(() => Number)
  @IsOptional()
  stop_loss?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit_1?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit_2?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit_3?: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_sl?: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_tp1?: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_tp2?: number;

  @Type(() => Number)
  @IsOptional()
  pips_to_tp3?: number;

  @IsString()
  @IsOptional()
  analysis?: string;

  @IsString()
  @IsOptional()
  timeframe?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsIn(['active', 'closed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsIn(['win', 'loss', 'breakeven'])
  @IsOptional()
  result?: string;

  @IsBoolean()
  @IsOptional()
  tp1_hit?: boolean;

  @IsBoolean()
  @IsOptional()
  tp2_hit?: boolean;

  @IsBoolean()
  @IsOptional()
  tp3_hit?: boolean;

  @Type(() => Number)
  @IsOptional()
  confidence_score?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  chart_image_url?: string;

  @IsDateString()
  @IsOptional()
  closed_at?: string;
}

