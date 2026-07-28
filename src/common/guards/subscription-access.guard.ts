import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_READ_ONLY_KEY } from '../decorators/allow-read-only.decorator';
import { SUBSCRIPTION_REPOSITORY } from '../../modules/database/constants/repositories.constants';
import { Subscription } from '../../modules/subscriptions/entities/subscription.model';
import { isReadOnly } from '../../modules/subscriptions/subscription-access';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Registered globally so a new mutating route is locked by default: opening it
// up for a suspended business has to be an explicit @AllowWhenReadOnly().
//
// Global guards run before route-level ones, so request.user is not populated
// here — role cannot be inspected. MASTER routes exempt themselves with the
// decorator instead.
@Injectable()
export class SubscriptionAccessGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{
      method: string;
      params?: Record<string, string | undefined>;
    }>();

    if (READ_METHODS.has(request.method)) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_READ_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    const businessId = request.params?.businessId;
    if (!businessId) return true;

    const subscription = await this.subscriptionModel.findOne({
      where: { businessId },
      attributes: ['status'],
    });

    // A paying customer must never be locked out by a missing row.
    if (!subscription) {
      this.logger.warn(`No subscription found for business ${businessId}`);
      return true;
    }

    if (isReadOnly(subscription.status)) {
      throw new ForbiddenException(
        'Tu complejo está en modo solo lectura porque la suscripción venció. ' +
          'Podés ver y cancelar tus reservas, pero para volver a operar necesitás activar un plan.',
      );
    }

    return true;
  }
}
