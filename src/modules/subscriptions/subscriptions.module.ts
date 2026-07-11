import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MercadoPagoModule } from '../mercadopago/mercadopago.module';
import { BusinessUsersModule } from '../business-users/business-users.module';
import {
  subscriptionProvider,
  businessFeatureProvider,
  paymentProvider,
} from './subscription.provider';
import { planProvider } from '../plans/plan.provider';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { FeatureActivationService } from './feature-activation.service';
import { TrialExpiryCron } from './trial-expiry.cron';
import { MasterBillingController } from './master-billing.controller';
import { MasterBillingService } from './master-billing.service';

@Module({
  imports: [DatabaseModule, MercadoPagoModule, BusinessUsersModule],
  controllers: [SubscriptionsController, WebhookController, MasterBillingController],
  providers: [
    SubscriptionsService,
    WebhookService,
    FeatureActivationService,
    TrialExpiryCron,
    MasterBillingService,
    ...subscriptionProvider,
    ...businessFeatureProvider,
    ...paymentProvider,
    ...planProvider,
  ],
  exports: [
    SubscriptionsService,
    FeatureActivationService,
    ...subscriptionProvider,
    ...businessFeatureProvider,
  ],
})
export class SubscriptionsModule {}
