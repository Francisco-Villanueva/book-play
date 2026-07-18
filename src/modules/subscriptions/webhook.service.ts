import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError } from 'sequelize';
import {
  SUBSCRIPTION_REPOSITORY,
  PLAN_REPOSITORY,
  PAYMENT_REPOSITORY,
  BUSINESS_USER_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Plan } from '../plans/entities/plan.model';
import { Payment } from './entities/payment.model';
import { BusinessUser } from '../business-users/entities/business-user.model';
import { User } from '../users/entities/user.model';
import { Business } from '../businesses/entities/business.model';
import {
  BusinessRole,
  PaymentStatus,
  SubscriptionStatus,
} from '../../common/enums';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';
import { FeatureActivationService } from './feature-activation.service';
import { MailService } from '../mail/mail.service';

interface BillingNotification {
  status: PaymentStatus;
  businessId: string;
  amount: number;
  paymentId: string;
  paidAt: Date;
  planName?: string;
  periodEnd?: Date;
}

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
    @Inject(BUSINESS_USER_REPOSITORY)
    private readonly businessUserModel: typeof BusinessUser,
    @Inject('SEQUELIZE')
    private readonly sequelize: Sequelize,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly featureActivationService: FeatureActivationService,
    private readonly mailService: MailService,
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
    if (!mpPayment) {
      this.logger.warn(
        `Payment ${paymentId} not found at Mercado Pago (404), ignoring webhook`,
      );
      return;
    }

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

    // Se puebla dentro de la transacción y se usa para enviar los correos una vez
    // confirmado el commit — nunca desde adentro de la transacción (si hace rollback
    // no debe salir ningún correo).
    let notification: BillingNotification | null = null;
    const amount = mpPayment.transaction_amount ?? 0;
    const paidAt = mpPayment.date_approved
      ? new Date(mpPayment.date_approved)
      : new Date();

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
            amount,
            status,
            paidAt,
            rawPayload: mpPayment as unknown as Record<string, unknown>,
          },
          { transaction },
        );

        if (status !== PaymentStatus.APPROVED) {
          notification = {
            status,
            businessId: subscription.businessId,
            amount,
            paymentId,
            paidAt,
          };
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

        notification = {
          status,
          businessId: subscription.businessId,
          amount,
          paymentId,
          paidAt,
          planName: plan.name,
          periodEnd: currentPeriodEnd,
        };

        this.logger.log(
          `Payment ${paymentId} approved, subscription ${subscription.id} active until ${currentPeriodEnd.toISOString()}`,
        );
      });

      // Fuera de la transacción: sólo se llega acá si el commit fue exitoso.
      // Un fallo de correo no debe devolver 500 (haría reintentar a Mercado Pago).
      if (notification) {
        try {
          await this.sendBillingEmails(notification);
        } catch (err) {
          this.logger.error(
            `Billing email step failed: ${(err as Error).message}`,
          );
        }
      }
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

  private async sendBillingEmails(
    notification: BillingNotification,
  ): Promise<void> {
    const ownerLink = await this.businessUserModel.findOne({
      where: {
        businessId: notification.businessId,
        role: BusinessRole.OWNER,
      },
      include: [
        { model: User, as: 'user', attributes: ['email', 'name'] },
        { model: Business, as: 'business', attributes: ['name'] },
      ],
    });

    const owner = ownerLink?.get('user') as User | undefined;
    const business = ownerLink?.get('business') as Business | undefined;
    if (!owner?.email) {
      this.logger.warn(
        `No owner email for business ${notification.businessId}, skipping billing email`,
      );
      return;
    }
    const businessName = business?.name ?? 'tu complejo';

    if (notification.status === PaymentStatus.APPROVED) {
      await this.mailService.sendPaymentReceipt({
        to: owner.email,
        recipientName: owner.name,
        businessName,
        planName: notification.planName,
        amount: Number(notification.amount),
        paidAt: notification.paidAt,
        paymentId: notification.paymentId,
      });
      if (notification.planName && notification.periodEnd) {
        await this.mailService.sendSubscriptionConfirmation({
          to: owner.email,
          recipientName: owner.name,
          businessName,
          planName: notification.planName,
          periodEnd: notification.periodEnd,
          businessId: notification.businessId,
        });
      }
    } else if (notification.status === PaymentStatus.REJECTED) {
      await this.mailService.sendPaymentRejected({
        to: owner.email,
        recipientName: owner.name,
        businessName,
        businessId: notification.businessId,
        amount: Number(notification.amount),
      });
    }
  }
}
