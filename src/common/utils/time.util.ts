// Helpers de tiempo compartidos entre reservas sueltas y turnos fijos. Las horas
// viajan como 'HH:mm' y la DB las devuelve como 'HH:mm:ss'.

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

// Fecha local del servidor, no UTC: el resto del dominio parsea las fechas como
// hora local ('YYYY-MM-DD' + 'T12:00:00'), y un "hoy" en UTC descarta el día en
// curso durante parte de la noche en zonas UTC-negativas como ART.
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
