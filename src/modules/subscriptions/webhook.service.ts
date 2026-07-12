import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import {
  SUBSCRIPTION_REPOSITORY,
  PLAN_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Plan } from '../plans/entities/plan.model';
import { Payment } from './entities/payment.model';
import { PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';
import { FeatureActivationService } from './feature-activation.service';

const MP_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  approved: PaymentStatus.APPROVED,
  accredited: PaymentStatus.APPROVED,
  pending: PaymentStatus.PENDING,
  in_process: PaymentStatus.PENDING,
  rejected: PaymentStatus.REJECTED,
  refunded: PaymentStatus.REFUNDED,
};

const BILLING_PERIOD_MONTHS = 1;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(PLAN_REPOSITORY)
    private readonly planModel: typeof Plan,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentModel: typeof Payment,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly featureActivationService: FeatureActivationService,
  ) {}

  async process(params: { type: string; dataId: string }): Promise<void> {
    this.logger.log(
      `Webhook passed signature check: type=${params.type} dataId=${params.dataId}`,
    );
    if (params.type === 'payment') {
      await this.handlePayment(params.dataId);
    }
  }

  private async handlePayment(paymentId: string): Promise<void> {
    const existingPayment = await this.paymentModel.findOne({
      where: { mpPaymentId: paymentId },
    });
    if (existingPayment) {
      this.logger.log(
        `Payment ${paymentId} already recorded, ignoring duplicate webhook`,
      );
      return;
    }

    const mpPayment = await this.mercadoPagoService.getPayment(paymentId);

    // external_reference is "{subscriptionId}:{planId}" — set by
    // subscriptions.service.createCheckout when the preference was created.
    const [subscriptionId, planId] = (mpPayment.external_reference ?? '').split(
      ':',
    );
    if (!subscriptionId || !planId) {
      this.logger.warn(
        `Payment ${paymentId} has no usable external_reference: "${mpPayment.external_reference}"`,
      );
      return;
    }

    const status =
      MP_PAYMENT_STATUS_MAP[mpPayment.status ?? ''] ?? PaymentStatus.PENDING;

    try {
      await this.sequelize.transaction(async (transaction) => {
        // Row-locked so a concurrent manual MASTER reactivation
        // (master-billing.service.reactivateSuspended) can't interleave with this
        // webhook and have one silently overwrite the other's write.
        const subscription = await this.subscriptionModel.findByPk(
          subscriptionId,
          { transaction, lock: transaction.LOCK.UPDATE },
        );
        if (!subscription) {
          this.logger.warn(
            `No subscription found for id ${subscriptionId} (payment ${paymentId})`,
          );
          return;
        }

        await this.paymentModel.create(
          {
            businessId: subscription.businessId,
            subscriptionId: subscription.id,
            planId,
            mpPaymentId: mpPayment.id,
            amount: mpPayment.transaction_amount ?? 0,
            status,
            paidAt: mpPayment.date_approved
              ? new Date(mpPayment.date_approved)
              : new Date(),
            rawPayload: mpPayment as unknown as Record<string, unknown>,
          },
          { transaction },
        );

        if (status !== PaymentStatus.APPROVED) {
          return;
        }

        const plan = await this.planModel.findByPk(planId, { transaction });
        if (!plan) {
          this.logger.warn(
            `Payment ${paymentId} references unknown plan ${planId}`,
          );
          return;
        }

        const now = new Date();
        const currentPeriodEnd = new Date(now);
        currentPeriodEnd.setMonth(
          currentPeriodEnd.getMonth() + BILLING_PERIOD_MONTHS,
        );

        await subscription.update(
          {
            status: SubscriptionStatus.ACTIVE,
            planId,
            suspendedAt: null,
            pastDueAt: null,
            cancelledAt: null,
            currentPeriodStart: now,
            currentPeriodEnd,
          },
          { transaction },
        );

        await this.featureActivationService.activateForPlan(
          subscription.businessId,
          plan,
          transaction,
        );

        this.logger.log(
          `Payment ${paymentId} approved, subscription ${subscription.id} active until ${currentPeriodEnd.toISOString()}`,
        );
      });
    } catch (error) {
      // A concurrent duplicate delivery can still race past the findOne check above —
      // the unique index on mp_payment_id is the actual idempotency guarantee.
      if (error instanceof UniqueConstraintError) {
        this.logger.log(
          `Payment ${paymentId} already recorded (race), ignoring duplicate webhook`,
        );
        return;
      }
      throw error;
    }
  }
}
