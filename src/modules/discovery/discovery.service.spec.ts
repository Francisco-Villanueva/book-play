import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRepository } from './discovery.repository';
import {
  AVAILABILITY_RULE_REPOSITORY,
  BOOKING_REPOSITORY,
  BUSINESS_REPOSITORY,
  EXCEPTION_RULE_REPOSITORY,
} from '../database/constants/repositories.constants';
import { SubscriptionStatus } from '../../common/enums';

// Fecha fija: la ventana por defecto arranca en "hoy", así que sin congelar el
// reloj los turnos generados caerían fuera del rango de las reglas.
const NOW = new Date('2026-08-13T14:00:00-03:00'); // jueves, 14:00 ART
const TODAY = '2026-08-13';
const TOMORROW = '2026-08-14';

interface CourtSeed {
  id: string;
  sportType?: string;
  slotDuration?: number;
  pricePerSlot?: number | null;
}

function business(
  id: string,
  name: string,
  courts: CourtSeed[],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    name,
    description: null,
    address: 'Calle 1',
    city: 'La Plata',
    citySlug: 'la-plata',
    province: 'Buenos Aires',
    latitude: null,
    longitude: null,
    timezone: 'America/Argentina/Buenos_Aires',
    subscription: { status: SubscriptionStatus.ACTIVE },
    courts: courts.map((c) => ({
      id: c.id,
      businessId: id,
      name: `Cancha ${c.id}`,
      sportType: c.sportType ?? 'padel',
      surface: 'Cemento',
      isIndoor: false,
      hasLighting: true,
      slotDuration: c.slotDuration ?? 60,
      pricePerSlot: c.pricePerSlot === undefined ? 20000 : c.pricePerSlot,
    })),
    ...extra,
  };
}

const rule = (businessId: string, courtIds: string[], dayOfWeek: number) => ({
  businessId,
  dayOfWeek,
  startTime: '18:00:00',
  endTime: '22:00:00',
  courts: courtIds.map((id) => ({ id })),
});

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let businessModel: { findAll: jest.Mock };
  let ruleModel: { findAll: jest.Mock };
  let exceptionModel: { findAll: jest.Mock };
  let bookingModel: { findAll: jest.Mock };

  const setup = async (seed: {
    businesses?: unknown[];
    rules?: unknown[];
    exceptions?: unknown[];
    bookings?: unknown[];
  }) => {
    businessModel = {
      findAll: jest.fn().mockResolvedValue(seed.businesses ?? []),
    };
    ruleModel = { findAll: jest.fn().mockResolvedValue(seed.rules ?? []) };
    exceptionModel = {
      findAll: jest.fn().mockResolvedValue(seed.exceptions ?? []),
    };
    bookingModel = {
      findAll: jest.fn().mockResolvedValue(seed.bookings ?? []),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        DiscoveryRepository,
        { provide: BUSINESS_REPOSITORY, useValue: businessModel },
        { provide: AVAILABILITY_RULE_REPOSITORY, useValue: ruleModel },
        { provide: EXCEPTION_RULE_REPOSITORY, useValue: exceptionModel },
        { provide: BOOKING_REPOSITORY, useValue: bookingModel },
      ],
    }).compile();

    service = module.get(DiscoveryService);
  };

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // El test más valioso del módulo. Todo el diseño es el conteo constante de
  // consultas: sin este assert, alguien agrega "una consultita" adentro del
  // loop en seis meses y el endpoint público se vuelve O(complejos × canchas).
  describe('conteo de consultas', () => {
    it('usa 4 consultas con 3 complejos × 3 canchas × 3 días', async () => {
      const businesses = ['b1', 'b2', 'b3'].map((id) =>
        business(id, `Complejo ${id}`, [
          { id: `${id}-c1` },
          { id: `${id}-c2` },
          { id: `${id}-c3` },
        ]),
      );
      const rules = businesses.flatMap((b) =>
        [4, 5, 6].map((dow) =>
          rule(
            b.id,
            b.courts.map((c) => c.id),
            dow,
          ),
        ),
      );

      await setup({ businesses, rules });
      const result = await service.listComplejos({
        city: 'la-plata',
        days: 3,
      } as never);

      expect(businessModel.findAll).toHaveBeenCalledTimes(1);
      expect(ruleModel.findAll).toHaveBeenCalledTimes(1);
      expect(exceptionModel.findAll).toHaveBeenCalledTimes(1);
      expect(bookingModel.findAll).toHaveBeenCalledTimes(1);
      expect(result.complejos).toHaveLength(3);
    });

    it('no crece al pasar de 1 a 10 complejos', async () => {
      const many = Array.from({ length: 10 }, (_, i) =>
        business(`b${i}`, `Complejo ${i}`, [{ id: `b${i}-c1` }]),
      );
      await setup({ businesses: many });
      await service.listComplejos({ city: 'la-plata' } as never);

      expect(businessModel.findAll).toHaveBeenCalledTimes(1);
      expect(ruleModel.findAll).toHaveBeenCalledTimes(1);
      expect(exceptionModel.findAll).toHaveBeenCalledTimes(1);
      expect(bookingModel.findAll).toHaveBeenCalledTimes(1);
    });

    it('no consulta disponibilidad si la ciudad no tiene complejos', async () => {
      await setup({ businesses: [] });
      await service.listComplejos({ city: 'ushuaia' } as never);

      expect(businessModel.findAll).toHaveBeenCalledTimes(1);
      expect(ruleModel.findAll).not.toHaveBeenCalled();
      expect(bookingModel.findAll).not.toHaveBeenCalled();
    });
  });

  describe('privacidad de la consulta de reservas', () => {
    // Ruta pública sin auth: omitir `attributes` traería guestName/guestPhone/
    // guestEmail/notes a memoria del proceso.
    it('sólo pide las 4 columnas necesarias de bookings', async () => {
      await setup({
        businesses: [business('b1', 'Uno', [{ id: 'c1' }])],
      });
      await service.listComplejos({ city: 'la-plata' } as never);

      const [options] = bookingModel.findAll.mock.calls[0] as [
        { attributes: string[]; raw: boolean },
      ];
      expect(options.attributes).toEqual([
        'courtId',
        'date',
        'startTime',
        'endTime',
      ]);
      expect(options.raw).toBe(true);
    });
  });

  describe('exclusión de complejos en solo lectura', () => {
    it.each([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED])(
      'esconde un complejo %s',
      async (status) => {
        await setup({
          businesses: [
            business('b1', 'Activo', [{ id: 'c1' }]),
            business('b2', 'Bloqueado', [{ id: 'c2' }], {
              subscription: { status },
            }),
          ],
        });
        const result = await service.listComplejos({
          city: 'la-plata',
        } as never);

        expect(result.complejos.map((c) => c.name)).toEqual(['Activo']);
      },
    );

    it.each([
      SubscriptionStatus.TRIALING,
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PAST_DUE,
    ])('sigue mostrando un complejo %s', async (status) => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }], { subscription: { status } }),
        ],
      });
      const result = await service.listComplejos({ city: 'la-plata' } as never);

      expect(result.complejos).toHaveLength(1);
    });

    it('muestra un complejo sin fila de suscripción', async () => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }], { subscription: null }),
        ],
      });
      const result = await service.listComplejos({ city: 'la-plata' } as never);

      expect(result.complejos).toHaveLength(1);
    });
  });

  describe('hasSchedule (BR-009)', () => {
    it('es false cuando el complejo todavía no publicó agenda', async () => {
      await setup({ businesses: [business('b1', 'Uno', [{ id: 'c1' }])] });
      const result = await service.listComplejos({ city: 'la-plata' } as never);

      expect(result.complejos[0].hasSchedule).toBe(false);
      expect(result.complejos[0].nextAvailable).toBeNull();
    });

    // Sin esta distinción, el complejo recién dado de alta es indistinguible
    // del que se quedó sin turnos, y no hay qué decirle al dueño.
    it('es true con agenda publicada, aunque no queden turnos', async () => {
      await setup({
        businesses: [business('b1', 'Uno', [{ id: 'c1' }])],
        rules: [rule('b1', ['c1'], 4)],
        bookings: [
          {
            courtId: 'c1',
            date: TODAY,
            startTime: '18:00:00',
            endTime: '19:00:00',
          },
          {
            courtId: 'c1',
            date: TODAY,
            startTime: '19:00:00',
            endTime: '20:00:00',
          },
          {
            courtId: 'c1',
            date: TODAY,
            startTime: '20:00:00',
            endTime: '21:00:00',
          },
          {
            courtId: 'c1',
            date: TODAY,
            startTime: '21:00:00',
            endTime: '22:00:00',
          },
        ],
      });
      const result = await service.listComplejos({
        city: 'la-plata',
        days: 1,
      } as never);

      expect(result.complejos[0].hasSchedule).toBe(true);
      expect(result.complejos[0].nextAvailable).toBeNull();
    });
  });

  describe('excepciones', () => {
    // El caso de corrupción silenciosa que motiva el LEFT JOIN sin `where`:
    // una excepción dirigida a OTRA cancha no puede apagar el complejo entero.
    it('un bloqueo de una cancha no afecta a las demás', async () => {
      await setup({
        businesses: [business('b1', 'Uno', [{ id: 'c1' }, { id: 'c2' }])],
        rules: [rule('b1', ['c1', 'c2'], 4)],
        exceptions: [
          {
            businessId: 'b1',
            date: TODAY,
            startTime: null,
            endTime: null,
            isAvailable: false,
            courts: [{ id: 'c1' }],
          },
        ],
      });
      const result = await service.listComplejos({
        city: 'la-plata',
        days: 1,
      } as never);

      expect(result.complejos[0].nextAvailable?.courtId).toBe('c2');
    });

    it('una excepción global apaga todas las canchas del complejo', async () => {
      await setup({
        businesses: [business('b1', 'Uno', [{ id: 'c1' }, { id: 'c2' }])],
        rules: [rule('b1', ['c1', 'c2'], 4)],
        exceptions: [
          {
            businessId: 'b1',
            date: TODAY,
            startTime: null,
            endTime: null,
            isAvailable: false,
            courts: [],
          },
        ],
      });
      const result = await service.listComplejos({
        city: 'la-plata',
        days: 1,
      } as never);

      expect(result.complejos[0].nextAvailable).toBeNull();
    });
  });

  describe('filtro por deporte', () => {
    it('descarta el complejo que no tiene ese deporte', async () => {
      await setup({
        businesses: [
          business('b1', 'Padelera', [{ id: 'c1', sportType: 'padel' }]),
          business('b2', 'Tenis Club', [{ id: 'c2', sportType: 'tenis' }]),
        ],
      });
      const result = await service.listComplejos({
        city: 'la-plata',
        sport: 'padel',
      } as never);

      expect(result.complejos.map((c) => c.name)).toEqual(['Padelera']);
    });

    // La card muestra todo lo que ofrece el lugar: filtrar por pádel no puede
    // hacer desaparecer el tenis de un complejo que tiene los dos.
    it('no recorta sports[] ni courtsCount del complejo que sí entra', async () => {
      await setup({
        businesses: [
          business('b1', 'Mixto', [
            { id: 'c1', sportType: 'padel' },
            { id: 'c2', sportType: 'tenis' },
          ]),
        ],
      });
      const result = await service.listComplejos({
        city: 'la-plata',
        sport: 'padel',
      } as never);

      expect(result.complejos[0].sports.sort()).toEqual(['padel', 'tenis']);
      expect(result.complejos[0].courtsCount).toBe(2);
    });
  });

  describe('listSlots', () => {
    it('ordena los turnos por fecha y hora a través de complejos', async () => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }]),
          business('b2', 'Dos', [{ id: 'c2' }]),
        ],
        rules: [rule('b1', ['c1'], 5), rule('b2', ['c2'], 5)],
      });
      const result = await service.listSlots({
        city: 'la-plata',
        date: TOMORROW,
        days: 1,
        limit: 4,
      } as never);

      expect(
        result.slots.map((s) => `${s.startTime} ${s.businessName}`),
      ).toEqual(['18:00 Dos', '18:00 Uno', '19:00 Dos', '19:00 Uno']);
      expect(result.meta.truncated).toBe(true);
    });
  });

  describe('ventana de fechas', () => {
    // Un visitante con el reloj corrido un día no tiene por qué ver un 400.
    it('recorta una fecha pasada a hoy en vez de rechazarla', async () => {
      await setup({ businesses: [] });
      const result = await service.listComplejos({
        city: 'la-plata',
        date: '2020-01-01',
      } as never);

      expect(result.from).toBe(TODAY);
    });
  });

  // La home arranca sin ciudad elegida: el jugador que entra por primera vez
  // tiene que ver qué hay antes de que le pidan decidir dónde.
  describe('búsqueda sin ciudad', () => {
    it('trae complejos de todas las ciudades', async () => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }]),
          business('b2', 'Dos', [{ id: 'c2' }], {
            city: 'Rosario',
            citySlug: 'rosario',
          }),
        ],
      });
      const result = await service.listComplejos({} as never);

      expect(new Set(result.complejos.map((c) => c.name))).toEqual(
        new Set(['Uno', 'Dos']),
      );
      expect(result.city).toBeNull();
    });

    // Sin ciudad el filtro no puede irse al `where`: pediría citySlug = undefined
    // y no volvería nada.
    it('no restringe la consulta por citySlug', async () => {
      await setup({ businesses: [] });
      await service.listComplejos({} as never);

      const [options] = businessModel.findAll.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(options.where['citySlug']).not.toBeUndefined();
      expect(typeof options.where['citySlug']).not.toBe('string');
    });

    it('el rail también abarca todo el país', async () => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }]),
          business('b2', 'Dos', [{ id: 'c2' }], { citySlug: 'rosario' }),
        ],
        rules: [rule('b1', ['c1'], 5), rule('b2', ['c2'], 5)],
      });
      const result = await service.listSlots({
        date: TOMORROW,
        days: 1,
        limit: 4,
      } as never);

      expect(new Set(result.slots.map((s) => s.businessName))).toEqual(
        new Set(['Uno', 'Dos']),
      );
      expect(result.city).toBeNull();
    });

    it('sigue filtrando por deporte sin ciudad', async () => {
      await setup({
        businesses: [
          business('b1', 'Padelera', [{ id: 'c1', sportType: 'padel' }]),
          business('b2', 'Tenis Club', [{ id: 'c2', sportType: 'tenis' }], {
            citySlug: 'rosario',
          }),
        ],
      });
      const result = await service.listComplejos({ sport: 'padel' } as never);

      expect(result.complejos.map((c) => c.name)).toEqual(['Padelera']);
    });
  });

  describe('listCities', () => {
    it('agrupa por slug y cuenta complejos', async () => {
      await setup({
        businesses: [
          business('b1', 'Uno', [{ id: 'c1' }]),
          business('b2', 'Dos', [{ id: 'c2' }]),
          business('b3', 'Tres', [{ id: 'c3' }], {
            city: 'Rosario',
            citySlug: 'rosario',
            province: 'Santa Fe',
          }),
        ],
      });
      const cities = await service.listCities();

      expect(cities).toEqual([
        {
          city: 'La Plata',
          citySlug: 'la-plata',
          province: 'Buenos Aires',
          businessesCount: 2,
        },
        {
          city: 'Rosario',
          citySlug: 'rosario',
          province: 'Santa Fe',
          businessesCount: 1,
        },
      ]);
    });
  });
});
