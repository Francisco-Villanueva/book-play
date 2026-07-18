import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import {
  SUBSCRIPTION_REPOSITORY,
  BUSINESS_USER_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { User } from '../users/entities/user.model';
import { Business } from '../businesses/entities/business.model';
import { BusinessRole, SubscriptionStatus } from '../../common/enums';
import { FeatureActivationService } from './feature-activation.service';
import { MailService } from '../mail/mail.service';

const PAST_DUE_GRACE_DAYS = 7;
const TRIAL_ENDING_NOTICE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrialExpiryCron {
  private readonly logger = new Logger(TrialExpiryCron.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    private readonly featureActivationService: FeatureActivationService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpirations(): Promise<void> {
    const now = new Date();

    await this.notifyEndingTrials(now);
    await this.suspendExpiredTrials(now);
    await this.markUnrenewedAsPastDue(now);
    await this.suspendPastDueOverGrace(now);
    await this.finalizeCancelledAtPeriodEnd(now);
  }

  // Avisa al OWNER cuando el trial está por vencer (dentro de N días) y todavía no
  // se notificó. El flag trialEndingNotifiedAt evita reenviar en cada corrida.
  private async notifyEndingTrials(now: Date): Promise<void> {
    const threshold = new Date(
      now.getTime() + TRIAL_ENDING_NOTICE_DAYS * DAY_MS,
    );
    const ending = await this.subscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndingNotifiedAt: null,
        trialEndsAt: { [Op.gt]: now, [Op.lte]: threshold },
      },
    });
    for (const subscription of ending) {
      const recipient = await this.resolveOwner(subscription.businessId);
      if (recipient) {
        const daysLeft = Math.max(
          1,
          Math.ceil(
            (subscription.trialEndsAt.getTime() - now.getTime()) / DAY_MS,
          ),
        );
        await this.mailService.sendTrialEnding({
          to: recipient.email,
          recipientName: recipient.name,
          businessName: recipient.businessName,
          trialEndsAt: subscription.trialEndsAt,
          daysLeft,
          businessId: subscription.businessId,
        });
      }
      await subscription.update({ trialEndingNotifiedAt: now });
    }
  }

  private async resolveOwner(
    businessId: string,
  ): Promise<{ email: string; name: string; businessName: string } | null> {
    const ownerLink = await this.businessUserModel.findOne({
      where: { businessId, role: BusinessRole.OWNER },
      include: [
        { model: User, as: 'user', attributes: ['email', 'name'] },
        { model: Business, as: 'business', attributes: ['name'] },
      ],
    });
    const owner = ownerLink?.get('user') as User | undefined;
    const business = ownerLink?.get('business') as Business | undefined;
    if (!owner?.email) return null;
    return {
      email: owner.email,
      name: owner.name,
      businessName: business?.name ?? 'tu complejo',
    };
  }

  // Checkout Pro is a one-off charge, not a recurring debit managed by Mercado
  // Pago — nothing on their side tells us a renewal was skipped, so this has to
  // detect it: an ACTIVE, non-cancelled subscription past its currentPeriodEnd
  // means the business didn't check out again for the next period.
  private async markUnrenewedAsPastDue(now: Date): Promise<void> {
    const unrenewed = await this.subscriptionModel.findAll({
      where: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        currentPeriodEnd: { [Op.lte]: now },
      },
    });
    for (const subscription of unrenewed) {
      await subscription.update({
        status: SubscriptionStatus.PAST_DUE,
        pastDueAt: now,
      });
      this.logger.log(
        `Period ended without renewal, marked past-due for business ${subscription.businessId}`,
      );
    }
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
