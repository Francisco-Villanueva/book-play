// Agrupación en memoria y fan-out sobre (complejo × cancha × fecha).
//
// Todo acá es puro: recibe las filas que `DiscoveryService` trajo con cuatro
// consultas y devuelve los turnos. Nada de I/O — es lo que garantiza que el
// costo de la búsqueda no crezca con la cantidad de complejos de la ciudad.

import {
  computeAvailableSlots,
  type BookingInput,
  type ExceptionInput,
  type RuleInput,
  type Slot,
} from '../bookings/availability.calculator';
import { EARTH_RADIUS_KM } from './discovery.constants';

export interface CourtRow {
  id: string;
  businessId: string;
  name: string;
  sportType: string | null;
  surface: string | null;
  isIndoor: boolean;
  hasLighting: boolean;
  slotDuration: number;
  pricePerSlot: number | null;
}

export interface RuleRow extends RuleInput {
  businessId: string;
  dayOfWeek: number;
  courtIds: string[];
}

export interface ExceptionRow extends ExceptionInput {
  businessId: string;
  date: string;
  // Vacío = excepción global del complejo, aplica a todas sus canchas.
  courtIds: string[];
}

export interface BookingRow extends BookingInput {
  courtId: string;
  date: string;
}

export interface CourtDaySlots {
  court: CourtRow;
  date: string;
  slots: Slot[];
}

const key = (...parts: (string | number)[]) => parts.join('|');

export interface AvailabilityIndex {
  rulesByCourtDow: Map<string, RuleInput[]>;
  exceptionsByBusinessDate: Map<string, ExceptionRow[]>;
  bookingsByCourtDate: Map<string, BookingInput[]>;
}

export function buildIndex(input: {
  rules: RuleRow[];
  exceptions: ExceptionRow[];
  bookings: BookingRow[];
}): AvailabilityIndex {
  const rulesByCourtDow = new Map<string, RuleInput[]>();
  for (const rule of input.rules) {
    for (const courtId of rule.courtIds) {
      const k = key(courtId, rule.dayOfWeek);
      const list = rulesByCourtDow.get(k);
      const entry = { startTime: rule.startTime, endTime: rule.endTime };
      if (list) list.push(entry);
      else rulesByCourtDow.set(k, [entry]);
    }
  }

  const exceptionsByBusinessDate = new Map<string, ExceptionRow[]>();
  for (const exc of input.exceptions) {
    const k = key(exc.businessId, exc.date);
    const list = exceptionsByBusinessDate.get(k);
    if (list) list.push(exc);
    else exceptionsByBusinessDate.set(k, [exc]);
  }

  const bookingsByCourtDate = new Map<string, BookingInput[]>();
  for (const booking of input.bookings) {
    const k = key(booking.courtId, booking.date);
    const list = bookingsByCourtDate.get(k);
    const entry = { startTime: booking.startTime, endTime: booking.endTime };
    if (list) list.push(entry);
    else bookingsByCourtDate.set(k, [entry]);
  }

  return { rulesByCourtDow, exceptionsByBusinessDate, bookingsByCourtDate };
}

// Réplica de `bookings.service.getApplicableExceptions`: una excepción sin
// canchas es global del complejo; una con canchas sólo toca las suyas.
function exceptionsForCourt(
  index: AvailabilityIndex,
  businessId: string,
  courtId: string,
  date: string,
): ExceptionInput[] {
  const all = index.exceptionsByBusinessDate.get(key(businessId, date)) ?? [];
  return all.filter(
    (exc) => exc.courtIds.length === 0 || exc.courtIds.includes(courtId),
  );
}

export function slotsForCourtDay(input: {
  index: AvailabilityIndex;
  court: CourtRow;
  date: string;
  dayOfWeek: number;
  // 'HH:mm' cuando `date` es hoy en la zona del complejo; null si no.
  cutoff: string | null;
}): Slot[] {
  const { index, court, date, dayOfWeek, cutoff } = input;

  return computeAvailableSlots({
    slotDuration: court.slotDuration,
    exceptions: exceptionsForCourt(index, court.businessId, court.id, date),
    rules: index.rulesByCourtDow.get(key(court.id, dayOfWeek)) ?? [],
    bookings: index.bookingsByCourtDate.get(key(court.id, date)) ?? [],
    cutoff,
  });
}

// Distancia en km. Con decenas de complejos por ciudad no hace falta PostGIS:
// esto corre sobre las filas ya filtradas por ciudad.
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
