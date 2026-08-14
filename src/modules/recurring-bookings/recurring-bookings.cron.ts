import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import {
  COURT_REPOSITORY,
  RECURRING_BOOKING_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '../database/constants/repositories.constants';
import { Court } from '../courts/entities/court.model';
import { Subscription } from '../subscriptions/entities/subscription.model';
import { isReadOnly } from '../subscriptions/subscription-access';
import { RecurringBookingStatus } from '../../common/enums';
import { RecurringBooking } from './entities/recurring-booking.model';
import { RecurringBookingsGenerator } from './recurring-bookings.generator';
import { todayLocalISO } from '../../common/utils/time.util';

@Injectable()
export class RecurringBookingsCron {
  private readonly logger = new Logger(RecurringBookingsCron.name);

  constructor(
    @Inject(RECURRING_BOOKING_REPOSITORY)
    private readonly recurringModel: typeof RecurringBooking,
    @Inject(COURT_REPOSITORY)
    private readonly courtModel: typeof Court,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionModel: typeof Subscription,
    private readonly generator: RecurringBookingsGenerator,
  ) {}

  // Diario: la ventana es de 12 semanas, así que basta con correr una vez por día
  // para que nunca se acorte. Es idempotente — `generatedUntil` marca lo ya hecho.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async extendSeries(): Promise<void> {
    const until = this.generator.horizonDate();

    const series = await this.recurringModel.findAll({
      where: {
        status: RecurringBookingStatus.ACTIVE,
        generatedUntil: { [Op.lt]: until },
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gte]: todayLocalISO() } },
        ],
      },
    });

    if (series.length === 0) return;

    const blocked = await this.readOnlyBusinessIds();
    let created = 0;
    let skipped = 0;

    for (const s of series) {
      // Un complejo vencido no puede seguir tomando turnos nuevos; la serie
      // queda viva y se completa sola cuando regulariza la suscripción.
      if (blocked.has(s.businessId)) continue;

      const court = await this.courtModel.findByPk(s.courtId);
      if (!court || !court.isActive) continue;

      try {
        const report = await this.generator.generateUpTo(s, court, until);
        created += report.created;
        skipped += report.skipped;
      } catch (err) {
        this.logger.error(
          `No se pudo extender la serie ${s.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Turnos fijos extendidos hasta ${until}: ${created} creados, ${skipped} salteados`,
    );
  }

  private async readOnlyBusinessIds(): Promise<Set<string>> {
    const subscriptions = await this.subscriptionModel.findAll({
      attributes: ['businessId', 'status'],
    });
    return new Set(
      subscriptions
        .filter((s) => isReadOnly(s.status))
        .map((s) => s.businessId),
    );
  }
}
