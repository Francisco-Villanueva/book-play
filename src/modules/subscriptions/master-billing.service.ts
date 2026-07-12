import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import {
  SUBSCRIPTION_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Payment } from './entities/payment.model';
import { Plan } from '../plans/entities/plan.model';
import { Business } from '../businesses/entities/business.model';
import { PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { FeatureActivationService } from './feature-activation.service';
import { TRIAL_FEATURE_KEYS } from './constants/trial-features.constant';

const DEFAULT_TRIAL_EXTENSION_DAYS = 7;

@Injectable()
export class MasterBillingService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentModel: typeof Payment,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly featureActivationService: FeatureActivationService,
  ) {}

  async getMrr(months: number): Promise<{ month: string; mrr: number }[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.sequelize.query<{ month: string; mrr: string }>(
      `SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, SUM(amount) AS mrr
       FROM payments
       WHERE status = :status AND paid_at >= :since
       GROUP BY 1
       ORDER BY 1 ASC`,
      {
        replacements: { status: PaymentStatus.APPROVED, since },
        type: 'SELECT' as any,
      },
    );

    return (rows as unknown as { month: string; mrr: string }[]).map((r) => ({
      month: r.month,
      mrr: Number(r.mrr),
    }));
  }

  async listTransactions(filters: { status?: PaymentStatus; limit?: number }) {
    return this.paymentModel.findAll({
      where: filters.status ? { status: filters.status } : {},
      include: [
        { model: Business, as: 'business', attributes: ['id', 'name'] },
        { model: Plan, as: 'plan', attributes: ['id', 'name'] },
      ],
      order: [['paidAt', 'DESC']],
      limit: filters.limit ?? 50,
    });
  }

  async reactivateSuspended(
    businessId: string,
    extendTrialDays?: number,
  ): Promise<Subscription> {
    // Row-locked so a concurrent webhook (e.g. a late `paused`/`cancelled` notification
    // in webhook.service.ts) can't interleave with this manual MASTER action and have
    // one silently overwrite the other's write.
    return this.sequelize.transaction(async (transaction) => {
      const subscription = await this.subscriptionModel.findOne({
        where: { businessId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }
      if (subscription.status !== SubscriptionStatus.SUSPENDED) {
        throw new BadRequestException('La suscripción no está suspendida');
      }

      if (subscription.planId) {
        await subscription.update(
          { status: SubscriptionStatus.ACTIVE, suspendedAt: null },
          { transaction },
        );
        const plan = await Plan.findByPk(subscription.planId, { transaction });
        if (plan) {
          await this.featureActivationService.activateForPlan(
            businessId,
            plan,
            transaction,
          );
        }
      } else {
        const newTrialEnd = new Date();
        newTrialEnd.setDate(
          newTrialEnd.getDate() +
            (extendTrialDays ?? DEFAULT_TRIAL_EXTENSION_DAYS),
        );
        await subscription.update(
          {
            status: SubscriptionStatus.TRIALING,
            suspendedAt: null,
            trialEndsAt: newTrialEnd,
          },
          { transaction },
        );
        await this.featureActivationService.activateFeatureKeys(
          businessId,
          TRIAL_FEATURE_KEYS,
          transaction,
        );
      }

      return subscription;
    });
  }
}
