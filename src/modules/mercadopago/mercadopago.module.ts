import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import mercadoPagoConfig from '../../config/mercadopago.config';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  imports: [ConfigModule.forFeature(mercadoPagoConfig)],
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
