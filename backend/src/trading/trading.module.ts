import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingAccount } from './entities/trading-account.entity';
import { TradingJournal } from './entities/trading-journal.entity';
import { TradingSignal } from './entities/trading-signal.entity';
import { TakenTrade } from './entities/taken-trade.entity';
import { AccountsService } from './services/accounts.service';
import { TradesService } from './services/trades.service';
import { SignalsService } from './services/signals.service';
import { AccountsController } from './controllers/accounts.controller';
import { TradesController } from './controllers/trades.controller';
import { SignalsController } from './controllers/signals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TradingAccount, TradingJournal, TradingSignal, TakenTrade])],
  controllers: [AccountsController, TradesController, SignalsController],
  providers: [AccountsService, TradesService, SignalsService],
  exports: [TypeOrmModule, AccountsService, TradesService, SignalsService],
})
export class TradingModule {}
