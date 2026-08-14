// Helpers de tiempo compartidos entre reservas sueltas y turnos fijos. Las horas
// viajan como 'HH:mm' y la DB las devuelve como 'HH:mm:ss'.

// Zona del complejo, NO la del proceso. El servidor corre en UTC (Render) y ART
// es UTC-3: leer la hora local del proceso adelanta el día a partir de las 21:00
// de Argentina, y con eso "hoy" pasa a ser mañana y la agenda de esta noche queda
// rechazada por fecha pasada. Todo el dominio resuelve el ahora contra esta zona.
export const APP_TIMEZONE =
  process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClockIn(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  // Intl devuelve la medianoche como hora 24 en algunos runtimes.
  const hour = get('hour') % 24;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

// Instante UTC que corresponde a una hora de pared en la zona del complejo.
// Se resuelve en dos pasos porque el desfase depende del instante; Argentina no
// tiene horario de verano, pero así el helper no miente si la zona cambia.
function instantFromWallClock(
  date: string,
  time: string,
  timeZone: string = APP_TIMEZONE,
): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = normalizeTime(time).split(':').map(Number);

  const guess = Date.UTC(y, m - 1, d, h, min, 0);
  const shown = wallClockIn(new Date(guess), timeZone);
  const shownAsUTC = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );

  return new Date(guess - (shownAsUTC - guess));
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

export function normalizeTime(time: string): string {
  return time.substring(0, 5);
}

// El "hoy" del complejo, no el del proceso ni el de UTC.
//
// `timeZone` sirve para la búsqueda pública, que en un mismo request abarca
// muchos complejos: aplicarles a todos un único "hoy" le ofrecería turnos de
// ayer al que ya cambió de día. El resto del dominio usa el default.
export function todayLocalISO(
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): string {
  const { year, month, day } = wallClockIn(now, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// La hora del complejo en el formato del dominio ('HH:mm').
export function nowLocalTime(
  now: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): string {
  const { hour, minute } = wallClockIn(now, timeZone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function addDaysToISODate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayOfWeekOfISODate(date: string): number {
  return new Date(date + 'T12:00:00').getDay();
}

// Primera fecha >= `from` que cae en `dayOfWeek` (0 = domingo, como Date.getDay()).
export function firstDateOnOrAfter(from: string, dayOfWeek: number): string {
  const diff = (dayOfWeek - dayOfWeekOfISODate(from) + 7) % 7;
  return addDaysToISODate(from, diff);
}

// Horas que faltan para el arranque de un turno, resuelto en la zona del
// complejo. Negativo si ya pasó.
export function hoursUntil(
  date: string,
  startTime: string,
  now: Date = new Date(),
): number {
  const start = instantFromWallClock(date, startTime);
  return (start.getTime() - now.getTime()) / 3_600_000;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
