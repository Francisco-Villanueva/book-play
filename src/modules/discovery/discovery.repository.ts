// Las cuatro consultas de la búsqueda pública, y nada más.
//
// Regla que gobierna este archivo: el costo tiene que ser CONSTANTE en cantidad
// de complejos, canchas y días. Cuatro `findAll`, siempre. Un `findAll` adentro
// de un loop rompe el propósito del módulo — hay un test que lo verifica.

import { Inject, Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Business } from '../businesses/entities/business.model';
import { Court } from '../courts/entities/court.model';
import { Booking } from '../bookings/entities/booking.model';
import { AvailabilityRule } from '../availability-rules/entities/availability-rule.model';
import { ExceptionRule } from '../exception-rules/entities/exception-rule.model';
import { Subscription } from '../subscriptions/entities/subscription.model';
import {
  AVAILABILITY_RULE_REPOSITORY,
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
} from '../database/constants/repositories.constants';
import { BookingStatus } from '../../common/enums';
import { isReadOnly } from '../subscriptions/subscription-access';
import { containsPattern } from '../../common/utils/like.util';
import { dayOfWeekOfISODate } from '../../common/utils/time.util';
import {
  buildIndex,
  type AvailabilityIndex,
  type BookingRow,
  type ExceptionRow,
  type RuleRow,
} from './discovery-availability';
import { MAX_BUSINESSES } from './discovery.constants';

export interface BusinessFilters {
  citySlug?: string | undefined;
  q?: string | undefined;
  sport?: string | undefined;
}

@Injectable()
export class DiscoveryRepository {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businessModel: typeof Business,
    @Inject(AVAILABILITY_RULE_REPOSITORY)
    private readonly availabilityRuleModel: typeof AvailabilityRule,
    @Inject(EXCEPTION_RULE_REPOSITORY)
    private readonly exceptionRuleModel: typeof ExceptionRule,
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingModel: typeof Booking,
  ) {}

  // --- Consulta 1 -----------------------------------------------------------

  async findBusinesses(filters: BusinessFilters): Promise<Business[]> {
    const businesses = await this.businessModel.findAll({
      where: {
        isListed: true,
        // Sin ciudad cargada un complejo no puede aparecer en un buscador cuyo
        // eje es la ciudad; el selector tampoco tendría dónde ubicarlo.
        citySlug: filters.citySlug ?? { [Op.ne]: null },
        ...(filters.q
          ? { name: { [Op.iLike]: containsPattern(filters.q) } }
          : {}),
      },
      attributes: [
        'id',
        'name',
        'description',
        'address',
        'city',
        'citySlug',
        'province',
        'latitude',
        'longitude',
        'timezone',
      ],
      include: [
        {
          model: Court,
          as: 'courts',
          // INNER JOIN a propósito: sin canchas activas no hay nada que reservar.
          required: true,
          where: { isActive: true },
          attributes: [
            'id',
            'businessId',
            'name',
            'sportType',
            'surface',
            'isIndoor',
            'hasLighting',
            'slotDuration',
            'pricePerSlot',
          ],
        },
        {
          model: Subscription,
          as: 'subscription',
          required: false,
          attributes: ['status'],
          // SIN `where`: con required:false Sequelize empuja la condición al ON
          // y el complejo suspendido vuelve igual con subscription:null, pasando
          // el filtro. El descarte se hace abajo, en memoria.
        },
      ],
      order: [['name', 'ASC']],
      limit: MAX_BUSINESSES,
    });

    const bookable = businesses.filter(
      (b) => !b.subscription || !isReadOnly(b.subscription.status),
    );

    // El deporte decide qué complejos entran, pero la card sigue mostrando
    // todas sus canchas — por eso se filtra acá y no dentro del include.
    if (!filters.sport) return bookable;
    return bookable.filter((b) =>
      (b.courts ?? []).some((c) => c.sportType === filters.sport),
    );
  }

  // --- Consultas 2, 3 y 4 ---------------------------------------------------

  async findAvailability(
    businesses: Business[],
    dates: string[],
  ): Promise<AvailabilityIndex> {
    const businessIds = businesses.map((b) => b.id);
    const courtIds = businesses.flatMap((b) =>
      (b.courts ?? []).map((c) => c.id),
    );

    if (!businessIds.length || !courtIds.length) {
      return buildIndex({ rules: [], exceptions: [], bookings: [] });
    }

    const dayOfWeeks = [...new Set(dates.map(dayOfWeekOfISODate))];
    const from = dates[0];
    const to = dates[dates.length - 1];

    const [rules, exceptions, bookings] = await Promise.all([
      this.availabilityRuleModel.findAll({
        where: {
          businessId: { [Op.in]: businessIds },
          dayOfWeek: { [Op.in]: dayOfWeeks },
          isActive: true,
        },
        attributes: ['id', 'businessId', 'dayOfWeek', 'startTime', 'endTime'],
        include: [
          {
            model: Court,
            as: 'courts',
            attributes: ['id'],
            through: { attributes: [] },
            // Acá filtrar el include SÍ es correcto: una regla sin canchas no
            // aplica a nada (BR-009), así que descartarla es lo que corresponde.
            required: true,
            where: { id: { [Op.in]: courtIds } },
          },
        ],
      }),
      this.exceptionRuleModel.findAll({
        where: {
          businessId: { [Op.in]: businessIds },
          date: { [Op.between]: [from, to] },
        },
        attributes: [
          'id',
          'businessId',
          'date',
          'startTime',
          'endTime',
          'isAvailable',
        ],
        include: [
          {
            model: Court,
            as: 'courts',
            attributes: ['id'],
            through: { attributes: [] },
            // LEFT JOIN SIN `where`, y no es negociable: con required:false la
            // condición se va al ON, y una excepción dirigida a una cancha que
            // no está en el set vuelve con courts:[] — indistinguible de una
            // global — y apagaría el complejo entero.
            required: false,
          },
        ],
      }),
      this.bookingModel.findAll({
        where: {
          courtId: { [Op.in]: courtIds },
          date: { [Op.between]: [from, to] },
          status: BookingStatus.ACTIVE,
        },
        // Explícito y mínimo: la ruta es pública y sin auth. Omitir `attributes`
        // traería guestName/guestPhone/guestEmail/notes a memoria.
        attributes: ['courtId', 'date', 'startTime', 'endTime'],
        raw: true,
      }),
    ]);

    return buildIndex({
      rules: rules.map(
        (r): RuleRow => ({
          businessId: r.businessId,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          courtIds: (r.courts ?? []).map((c) => c.id),
        }),
      ),
      exceptions: exceptions.map(
        (e): ExceptionRow => ({
          businessId: e.businessId,
          date: e.date,
          startTime: e.startTime ?? null,
          endTime: e.endTime ?? null,
          isAvailable: e.isAvailable,
          courtIds: (e.courts ?? []).map((c) => c.id),
        }),
      ),
      bookings: bookings as unknown as BookingRow[],
    });
  }
}
