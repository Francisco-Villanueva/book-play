// Normaliza un texto libre a una clave estable para comparar y agrupar.
// Existe para la ciudad del complejo: sin esto "CABA", "Capital Federal" y
// "capital federal" son tres ciudades distintas en el selector público.
export function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
