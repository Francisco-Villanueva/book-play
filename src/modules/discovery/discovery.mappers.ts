// Del modelo de Sequelize a lo que devuelve la API pública. Todo puro: el
// service se queda sólo con la orquestación.

import { Business } from '../businesses/entities/business.model';
import {
  dayOfWeekOfISODate,
  nowLocalTime,
  todayLocalISO,
} from '../../common/utils/time.util';
import {
  haversineKm,
  slotsForCourtDay,
  type AvailabilityIndex,
  type CourtRow,
} from './discovery-availability';
import type { DiscoveryComplejo, NextSlot } from './discovery.types';

// Postgres devuelve DECIMAL como string para no perder precisión.
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function courtsOf(business: Business): CourtRow[] {
  return (business.courts ?? []).map((c) => ({
    id: c.id,
    businessId: c.businessId,
    name: c.name,
    sportType: c.sportType ?? null,
    surface: c.surface ?? null,
    isIndoor: c.isIndoor,
    hasLighting: c.hasLighting,
    slotDuration: c.slotDuration,
    pricePerSlot: toNumber(c.pricePerSlot),
  }));
}

// Recorre (fecha × cancha × turno) resolviendo "hoy" y "ahora" en la zona DEL
// COMPLEJO: un request abarca muchos tenants, y aplicarles un único "hoy" le
// ofrecería turnos de ayer al que ya cambió de día.
export function forEachOpenSlot(
  input: {
    business: Business;
    courts: CourtRow[];
    index: AvailabilityIndex;
    dates: string[];
  },
  visit: (
    court: CourtRow,
    date: string,
    slot: { startTime: string; endTime: string },
    slotIndex: number,
  ) => void,
): void {
  const { business, courts, index, dates } = input;
  const now = new Date();
  const today = todayLocalISO(now, business.timezone);
  const cutoffNow = nowLocalTime(now, business.timezone);

  for (const date of dates) {
    if (date < today) continue;
    const dayOfWeek = dayOfWeekOfISODate(date);
    const cutoff = date === today ? cutoffNow : null;

    for (const court of courts) {
      slotsForCourtDay({ index, court, date, dayOfWeek, cutoff }).forEach(
        (slot, i) => visit(court, date, slot, i),
      );
    }
  }
}

export function describeComplejo(input: {
  business: Business;
  index: AvailabilityIndex;
  dates: string[];
  sport: string | undefined;
  origin: { latitude: number; longitude: number } | null;
}): DiscoveryComplejo {
  const { business, index, dates, sport, origin } = input;

  const courts = courtsOf(business);
  const matching = sport ? courts.filter((c) => c.sportType === sport) : courts;

  let availableCount = 0;
  let availableToday = 0;
  let nextAvailable: NextSlot | null = null;
  const today = todayLocalISO(new Date(), business.timezone);

  forEachOpenSlot(
    { business, courts: matching, index, dates },
    (court, date, slot, slotIndex) => {
      availableCount += 1;
      if (date === today) availableToday += 1;

      // Sólo el primer turno de cada (cancha, fecha) puede ser "el próximo".
      if (slotIndex !== 0) return;
      if (
        !nextAvailable ||
        date < nextAvailable.date ||
        (date === nextAvailable.date &&
          slot.startTime < nextAvailable.startTime)
      ) {
        nextAvailable = {
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courtId: court.id,
          courtName: court.name,
          sportType: court.sportType,
          pricePerSlot: court.pricePerSlot,
        };
      }
    },
  );

  const prices = matching
    .map((c) => c.pricePerSlot)
    .filter((p): p is number => p != null);
  const latitude = toNumber(business.latitude);
  const longitude = toNumber(business.longitude);
  const dayOfWeeks = [...new Set(dates.map(dayOfWeekOfISODate))];

  return {
    id: business.id,
    name: business.name,
    description: business.description ?? null,
    address: business.address ?? null,
    city: business.city ?? null,
    province: business.province ?? null,
    latitude,
    longitude,
    distanceKm:
      origin && latitude != null && longitude != null
        ? Math.round(haversineKm(origin, { latitude, longitude }) * 10) / 10
        : null,
    // Describen el complejo entero, no el filtro: el jugador espera ver en la
    // card todo lo que ese lugar ofrece.
    courtsCount: courts.length,
    sports: [
      ...new Set(
        courts.map((c) => c.sportType).filter((s): s is string => Boolean(s)),
      ),
    ],
    priceFrom: prices.length ? Math.min(...prices) : null,
    // Distingue "todavía no publicó su agenda" (BR-009) de "no le quedan
    // turnos". Sin esta bandera la pantalla no puede decir cuál de las dos es,
    // y un complejo recién dado de alta se vuelve invisible sin diagnóstico.
    hasSchedule: matching.some((c) =>
      dayOfWeeks.some((dow) => index.rulesByCourtDow.has(`${c.id}|${dow}`)),
    ),
    availableToday,
    availableCount,
    nextAvailable,
  };
}

export function sortComplejos(
  complejos: DiscoveryComplejo[],
  sort: string | undefined,
): void {
  if (sort === 'name') {
    complejos.sort((a, b) => a.name.localeCompare(b.name));
    return;
  }

  if (sort === 'distance') {
    // Los complejos sin coordenadas van al final en vez de desaparecer.
    complejos.sort(
      (a, b) =>
        (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
        a.name.localeCompare(b.name),
    );
    return;
  }

  // Por defecto: primero el que juega antes; el que no tiene ningún turno, al
  // fondo. '￿' ordena después de cualquier fecha.
  const key = (c: DiscoveryComplejo) =>
    c.nextAvailable
      ? `${c.nextAvailable.date}T${c.nextAvailable.startTime}`
      : '￿';

  complejos.sort(
    (a, b) => key(a).localeCompare(key(b)) || a.name.localeCompare(b.name),
  );
}
