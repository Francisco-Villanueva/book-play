import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
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
  imports: [BusinessUsersModule, DatabaseModule, UsersModule, MailModule],
  controllers: [BusinessesController],
  providers: [
    BusinessesService,
    ...businessProvider,
    ...subscriptionProvider,
    ...businessFeatureProvider,
  ],
  exports: [BusinessesService, ...businessProvider],
})
export class BusinessesModule {}
