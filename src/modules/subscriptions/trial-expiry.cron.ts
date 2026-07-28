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
import {
  DAY_MS,
  PAST_DUE_GRACE_DAYS,
  resolveExpiresAt,
} from './subscription-access';

// Hitos de aviso previo al vencimiento, del más lejano al más cercano.
const EXPIRY_NOTICE_DAYS = [10, 5, 1] as const;

// Recordatorios posteriores al bloqueo, en días desde que quedó en solo lectura.
// El de 330 avisa la anonimización de datos de invitados con 30 días de margen.
const SUSPENDED_NOTICE_DAYS = [0, 30, 90, 330] as const;

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

    await this.notifyUpcomingExpiry(now);
    await this.suspendExpiredTrials(now);
    await this.markUnrenewedAsPastDue(now);
    await this.suspendPastDueOverGrace(now);
    await this.finalizeCancelledAtPeriodEnd(now);
    await this.notifySuspended(now);
  }

  // Avisa al OWNER a los 10, 5 y 1 día del vencimiento, sirva el trial o el
  // período pago. Guardar el hito enviado (y no un booleano) es lo que permite
  // escalar el tono sin repetir el mismo correo en cada corrida horaria.
  private async notifyUpcomingExpiry(now: Date): Promise<void> {
    const active = await this.subscriptionModel.findAll({
      where: {
        status: {
          [Op.in]: [
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
    });

    for (const subscription of active) {
      const expiresAt = resolveExpiresAt(subscription);
      if (!expiresAt) continue;

      const daysLeft = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / DAY_MS,
      );
      const milestone = EXPIRY_NOTICE_DAYS.find((d) => daysLeft <= d);
      if (milestone === undefined) continue;

      const alreadySent = subscription.lastExpiryNoticeDays;
      if (alreadySent !== null && alreadySent <= milestone) continue;

      const recipient = await this.resolveOwner(subscription.businessId);
      if (recipient) {
        await this.mailService.sendSubscriptionExpiring({
          to: recipient.email,
          recipientName: recipient.name,
          businessName: recipient.businessName,
          expiresAt,
          daysLeft: Math.max(0, daysLeft),
          reason:
            subscription.status === SubscriptionStatus.TRIALING
              ? 'trial'
              : 'subscription',
          businessId: subscription.businessId,
        });
      }
      await subscription.update({ lastExpiryNoticeDays: milestone });
    }
  }

  // Recordatorios de reconversión mientras el complejo sigue en solo lectura.
  // CANCELLED entra igual: el acceso está bloqueado del mismo modo y el reloj
  // de retención corre para ambos.
  private async notifySuspended(now: Date): Promise<void> {
    const locked = await this.subscriptionModel.findAll({
      where: {
        status: {
          [Op.in]: [SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED],
        },
        suspendedAt: { [Op.not]: null },
      },
    });

    for (const subscription of locked) {
      const suspendedAt = subscription.suspendedAt;
      if (!suspendedAt) continue;

      const daysSuspended = Math.floor(
        (now.getTime() - suspendedAt.getTime()) / DAY_MS,
      );
      const milestone = [...SUSPENDED_NOTICE_DAYS]
        .reverse()
        .find((d) => daysSuspended >= d);
      if (milestone === undefined) continue;

      const alreadySent = subscription.lastSuspendedNoticeDays;
      if (alreadySent !== null && alreadySent >= milestone) continue;

      const recipient = await this.resolveOwner(subscription.businessId);
      if (recipient) {
        await this.mailService.sendSubscriptionSuspended({
          to: recipient.email,
          recipientName: recipient.name,
          businessName: recipient.businessName,
          daysSuspended: milestone,
          businessId: subscription.businessId,
        });
      }
      await subscription.update({ lastSuspendedNoticeDays: milestone });
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
      // El vencimiento efectivo pasa a ser el fin de la gracia, así que la
      // escalada de avisos arranca de cero sobre esa nueva fecha.
      await subscription.update({
        status: SubscriptionStatus.PAST_DUE,
        pastDueAt: now,
        lastExpiryNoticeDays: null,
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
      now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS,
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
      // suspendedAt marca "desde cuándo quedó en solo lectura", que es lo que
      // mide el reloj de retención — vale igual para una baja voluntaria.
      await subscription.update({
        status: SubscriptionStatus.CANCELLED,
        suspendedAt: now,
      });
      await this.featureActivationService.deactivatePlanFeatures(
        subscription.businessId,
      );
      this.logger.log(
        `Cancellation finalized for business ${subscription.businessId}`,
      );
    }
  }
}
