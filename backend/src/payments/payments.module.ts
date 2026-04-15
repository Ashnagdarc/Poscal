import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '../auth/entities/user.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RevenuecatModule } from '../revenuecat/revenuecat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User]),
    RevenuecatModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [TypeOrmModule, PaymentsService],
})
export class PaymentsModule {}
