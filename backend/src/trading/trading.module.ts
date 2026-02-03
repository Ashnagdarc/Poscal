import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { TradingJournal } from './entities/trading-journal.entity';
import { TradingSignal } from './entities/trading-signal.entity';
import { TradingAccount } from './entities/trading-account.entity';
import { TradesService } from './services/trades.service';
import { SignalsService } from './services/signals.service';
import { AccountsService } from './services/accounts.service';
import { TradesController } from './controllers/trades.controller';
import { SignalsController } from './controllers/signals.controller';
import { AccountsController } from './controllers/accounts.controller';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([TradingJournal, TradingSignal, TradingAccount]), StorageModule, AuthModule],
  controllers: [TradesController, SignalsController, AccountsController],
  providers: [TradesService, SignalsService, AccountsService, AdminGuard],
  exports: [TypeOrmModule, TradesService, SignalsService, AccountsService],
})
export class TradingModule {}
