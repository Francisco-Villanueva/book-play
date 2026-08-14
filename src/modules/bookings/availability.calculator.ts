// La regla BR-007 (ExceptionRule > AvailabilityRule > Booking) resuelta en
// memoria, sin Nest, sin Sequelize y sin reloj.
//
// Vivía incrustada en `bookings.service.getAvailableSlots`, que la calcula para
// UNA cancha en UN día a costa de hasta 5 consultas. La búsqueda pública tiene
// que resolver cientos de canchas por ciudad: necesita las mismas reglas
// alimentadas por consultas batcheadas. Duplicar la lógica sería garantizar que
// las dos pantallas se contradigan.

import { addMinutesToTime, normalizeTime } from '../../common/utils/time.util';

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Slot {
  startTime: string;
  endTime: string;
}

// Formas estructurales, no modelos: el camino batcheado pasa filas planas y el
// de una cancha pasa instancias de Sequelize. Ambas encajan.
export interface ExceptionInput {
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface RuleInput {
  startTime: string;
  endTime: string;
}

export interface BookingInput {
  startTime: string;
  endTime: string;
}

export interface ExceptionPlan {
  closedAllDay: boolean;
  openWindows: TimeWindow[];
  blockedRanges: TimeWindow[];
  hasEnablingException: boolean;
}

// Va separado de `buildSlotGrid` para que el llamador pueda decidir, con
// `hasEnablingException`, si le hace falta consultar las reglas semanales: una
// excepción habilitante ya define la ventana y esa consulta sobra.
export function classifyExceptions(
  exceptions: ExceptionInput[],
): ExceptionPlan {
  const openWindows: TimeWindow[] = [];
  const blockedRanges: TimeWindow[] = [];
  let hasEnablingException = false;

  for (const exc of exceptions) {
    const start = exc.startTime ? normalizeTime(exc.startTime) : null;
    const end = exc.endTime ? normalizeTime(exc.endTime) : null;

    if (!exc.isAvailable) {
      // Bloqueo sin horario = el día entero cerrado, sin importar el orden en
      // que vengan las excepciones.
      if (!start || !end) {
        return {
          closedAllDay: true,
          openWindows: [],
          blockedRanges: [],
          hasEnablingException: false,
        };
      }
      blockedRanges.push({ start, end });
    } else if (start && end) {
      openWindows.push({ start, end });
      hasEnablingException = true;
    }
  }

  return {
    closedAllDay: false,
    openWindows,
    blockedRanges,
    hasEnablingException,
  };
}

export function buildSlotGrid(input: {
  plan: ExceptionPlan;
  rules: RuleInput[];
  bookings: BookingInput[];
  slotDuration: number;
  // 'HH:mm' para el día en curso, null cuando no hay nada que recortar.
  cutoff: string | null;
}): Slot[] {
  const { plan, rules, bookings, slotDuration, cutoff } = input;

  if (plan.closedAllDay || slotDuration <= 0) return [];

  // La excepción habilitante pisa la agenda semanal (BR-007); sin ella mandan
  // las reglas. Sin reglas no hay nada abierto y la cancha no es reservable
  // (BR-009) — no hace falta un caso especial: la grilla queda vacía sola.
  const openWindows = plan.hasEnablingException
    ? plan.openWindows
    : rules.map((r) => ({
        start: normalizeTime(r.startTime),
        end: normalizeTime(r.endTime),
      }));

  const booked = bookings.map((b) => ({
    start: normalizeTime(b.startTime),
    end: normalizeTime(b.endTime),
  }));

  const slots: Slot[] = [];
  // Dos reglas semanales solapadas (08-12 y 10-14) generarían el mismo turno
  // dos veces: en una grilla de una cancha no se nota, en un listado de ciudad sí.
  const seen = new Set<string>();

  for (const window of openWindows) {
    let slotStart = window.start;
    while (true) {
      const slotEnd = addMinutesToTime(slotStart, slotDuration);
      // El turno que no entra completo en la ventana no se ofrece.
      if (slotEnd > window.end) break;

      const isOver = cutoff !== null && slotEnd <= cutoff;
      const isBlocked = plan.blockedRanges.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );
      const isBooked = booked.some(
        (b) => slotStart < b.end && slotEnd > b.start,
      );

      if (!isOver && !isBlocked && !isBooked && !seen.has(slotStart)) {
        seen.add(slotStart);
        slots.push({ startTime: slotStart, endTime: slotEnd });
      }
      slotStart = slotEnd;
    }
  }

  // Ventanas desordenadas darían turnos desordenados, y el listado público los
  // muestra como "el próximo".
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// Para quien ya tiene todo en memoria y no puede ahorrarse ninguna consulta.
export function computeAvailableSlots(input: {
  slotDuration: number;
  exceptions: ExceptionInput[];
  rules: RuleInput[];
  bookings: BookingInput[];
  cutoff: string | null;
}): Slot[] {
  const { slotDuration, exceptions, rules, bookings, cutoff } = input;
  return buildSlotGrid({
    plan: classifyExceptions(exceptions),
    rules,
    bookings,
    slotDuration,
    cutoff,
  });
}
