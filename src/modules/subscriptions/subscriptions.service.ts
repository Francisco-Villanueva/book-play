import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SUBSCRIPTION_REPOSITORY,
  PLAN_REPOSITORY,
  PAYMENT_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Subscription } from './entities/subscription.model';
import { Plan } from '../plans/entities/plan.model';
import { Payment } from './entities/payment.model';
import { MercadoPagoService } from '../mercadopago/mercadopago.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    @Inject(PLAN_REPOSITORY)
    private readonly planModel: typeof Plan,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentModel: typeof Payment,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  async findByBusiness(businessId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findOne({
      where: { businessId },
      include: [{ model: Plan, as: 'plan' }],
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async listPayments(businessId: string): Promise<Payment[]> {
    return this.paymentModel.findAll({
      where: { businessId },
      order: [['paidAt', 'DESC']],
    });
  }

  async createCheckout(
    businessId: string,
    planId: string,
    payerEmail: string,
  ): Promise<{ checkoutUrl: string }> {
    const [subscription, plan] = await Promise.all([
      this.findByBusiness(businessId),
      this.planModel.findByPk(planId),
    ]);

    if (!plan || plan.isArchived) {
      throw new NotFoundException('Plan not found');
    }

    // Charging happens once per period, on demand — the webhook activates the
    // subscription for the plan/amount encoded here, not whatever is in the DB
    // by the time the payment is confirmed (price could have changed since).
    const preference = await this.mercadoPagoService.createPreference({
      title: plan.name,
      amount: plan.priceArs,
      externalReference: `${subscription.id}:${plan.id}`,
      payerEmail,
      backUrlPath: `/admin/${businessId}/upgrade/confirm`,
    });

    if (!preference.init_point) {
      throw new BadRequestException(
        'Mercado Pago no devolvió una URL de checkout',
      );
    }

    return { checkoutUrl: preference.init_point };
  }

  async cancel(businessId: string): Promise<Subscription> {
    const subscription = await this.findByBusiness(businessId);

    // Nothing to cancel on Mercado Pago's side — there's no recurring charge
    // running there. Access is kept until currentPeriodEnd, enforced by
    // trial-expiry.cron; renewing again just means a fresh checkout.
    await subscription.update({ cancelledAt: new Date() });
    return subscription;
  }

  async reactivate(businessId: string): Promise<Subscription> {
    const subscription = await this.findByBusiness(businessId);

    if (!subscription.cancelledAt) {
      throw new BadRequestException('La suscripción no está cancelada');
    }
    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd <= new Date()
    ) {
      throw new BadRequestException(
        'El período pago ya venció, iniciá un nuevo checkout',
      );
    }

    await subscription.update({ cancelledAt: null });
    return subscription;
  }
}
