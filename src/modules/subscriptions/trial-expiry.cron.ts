import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import { SUBSCRIPTION_REPOSITORY } from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { SubscriptionStatus } from '../../common/enums';
import { FeatureActivationService } from './feature-activation.service';

const PAST_DUE_GRACE_DAYS = 7;

@Injectable()
export class TrialExpiryCron {
  private readonly logger = new Logger(TrialExpiryCron.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    private readonly featureActivationService: FeatureActivationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpirations(): Promise<void> {
    const now = new Date();

    await this.suspendExpiredTrials(now);
    await this.suspendPastDueOverGrace(now);
    await this.finalizeCancelledAtPeriodEnd(now);
  }

  private async suspendExpiredTrials(now: Date): Promise<void> {
    const expired = await this.subscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { [Op.lte]: now },
      },
    });
    for (const subscription of expired) {
      await subscription.update({
        status: SubscriptionStatus.SUSPENDED,
        suspendedAt: now,
      });
      await this.featureActivationService.deactivatePlanFeatures(
        subscription.businessId,
      );
      this.logger.log(
        `Trial expired, suspended business ${subscription.businessId}`,
      );
    }
  }

  private async suspendPastDueOverGrace(now: Date): Promise<void> {
    const graceDeadline = new Date(
      now.getTime() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    const overdue = await this.subscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        pastDueAt: { [Op.lte]: graceDeadline },
      },
    });
    for (const subscription of overdue) {
      await subscription.update({
        status: SubscriptionStatus.SUSPENDED,
        suspendedAt: now,
      });
      await this.featureActivationService.deactivatePlanFeatures(
        subscription.businessId,
      );
      this.logger.log(
        `Past-due grace period ended, suspended business ${subscription.businessId}`,
      );
    }
  }

  private async finalizeCancelledAtPeriodEnd(now: Date): Promise<void> {
    const toCancel = await this.subscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: { [Op.not]: null },
        currentPeriodEnd: { [Op.lte]: now },
      },
    });
    for (const subscription of toCancel) {
      await subscription.update({ status: SubscriptionStatus.CANCELLED });
      await this.featureActivationService.deactivatePlanFeatures(
        subscription.businessId,
      );
      this.logger.log(
        `Cancellation finalized for business ${subscription.businessId}`,
      );
    }
  }
}
