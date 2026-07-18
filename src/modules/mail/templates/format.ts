// Formateo en convención argentina para el cuerpo de los correos.

const DAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// "2026-07-21" -> "martes 21 de julio de 2026"
export function formatDateAr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} ${d} de ${MONTHS[m - 1]} de ${y}`;
}

// "09:00:00" | "09:00" -> "09:00"
export function formatTime(time: string): string {
  return time.substring(0, 5);
}

// 12500 -> "$ 12.500,00"
export function formatCurrency(amount: number): string {
  return `$ ${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
