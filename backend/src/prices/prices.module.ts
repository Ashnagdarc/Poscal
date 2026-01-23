import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PriceCache } from './entities/price-cache.entity';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PriceCache]), AuthModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [TypeOrmModule, PricesService],
})
export class PricesModule {}
