import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { planProvider } from './plan.provider';
import { subscriptionProvider } from '../subscriptions/subscription.provider';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { MasterPlansController } from './master-plans.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PlansController, MasterPlansController],
  providers: [PlansService, ...planProvider, ...subscriptionProvider],
  exports: [PlansService, ...planProvider],
})
export class PlansModule {}
