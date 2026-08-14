import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import geocodingConfig from '../../config/geocoding.config';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { BusinessLocationService } from './business-location.service';
import { GeocodingService } from './geocoding.service';
import { businessProvider } from './business.provider';
import { BusinessUsersModule } from '../business-users/business-users.module';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import {
  subscriptionProvider,
  businessFeatureProvider,
} from '../subscriptions/subscription.provider';

@Module({
  imports: [
    BusinessUsersModule,
    DatabaseModule,
    UsersModule,
    MailModule,
    ConfigModule.forFeature(geocodingConfig),
  ],
  controllers: [BusinessesController],
  providers: [
    BusinessesService,
    BusinessLocationService,
    GeocodingService,
    ...businessProvider,
    ...subscriptionProvider,
    ...businessFeatureProvider,
  ],
  exports: [BusinessesService, ...businessProvider],
})
export class BusinessesModule {}
