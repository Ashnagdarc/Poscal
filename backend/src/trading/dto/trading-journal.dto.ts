import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsUUID()
  @IsNotEmpty()
  account_id: string;

  @IsDateString()
  @IsNotEmpty()
  trade_date: string;

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
  @IsOptional()
  exit_price?: number;

  @Type(() => Number)
  @IsNotEmpty()
  position_size: number;

  @Type(() => Number)
  @IsOptional()
  stop_loss?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit?: number;

  @Type(() => Number)
  @IsOptional()
  profit_loss?: number;

  @Type(() => Number)
  @IsOptional()
  profit_loss_percentage?: number;

  @IsIn(['open', 'closed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  strategy?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsString()
  @IsOptional()
  screenshots?: string;

  @IsString()
  @IsOptional()
  trade_setup?: string;

  @IsString()
  @IsOptional()
  psychological_state?: string;

  @Type(() => Number)
  @IsOptional()
  risk_reward_ratio?: number;

  @Type(() => Number)
  @IsOptional()
  session_number?: number;

  @IsString()
  @IsOptional()
  market_condition?: string;
}

export class UpdateTradeDto {
  @IsDateString()
  @IsOptional()
  trade_date?: string;

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
  exit_price?: number;

  @Type(() => Number)
  @IsOptional()
  position_size?: number;

  @Type(() => Number)
  @IsOptional()
  stop_loss?: number;

  @Type(() => Number)
  @IsOptional()
  take_profit?: number;

  @Type(() => Number)
  @IsOptional()
  profit_loss?: number;

  @Type(() => Number)
  @IsOptional()
  profit_loss_percentage?: number;

  @IsIn(['open', 'closed', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  strategy?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsString()
  @IsOptional()
  screenshots?: string;

  @IsString()
  @IsOptional()
  trade_setup?: string;

  @IsString()
  @IsOptional()
  psychological_state?: string;

  @Type(() => Number)
  @IsOptional()
  risk_reward_ratio?: number;

  @Type(() => Number)
  @IsOptional()
  session_number?: number;

  @IsString()
  @IsOptional()
  market_condition?: string;
}
