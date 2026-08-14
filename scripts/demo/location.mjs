// Ciudad/provincia a partir del `address` de texto libre, compartido por el
// seed y el backfill. Espejo de src/common/utils/slug.util.ts.

export const toSlug = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// CABA se escribe de mil formas y sus direcciones nombran el barrio donde otras
// nombran la ciudad ("Gorriti 5480, Palermo, CABA"). Sin este caso especial,
// Palermo y Belgrano quedan como dos ciudades distintas en el selector.
const CABA_MARKERS = new Set([
  'caba',
  'capital-federal',
  'ciudad-de-buenos-aires',
  'ciudad-autonoma-de-buenos-aires',
  'buenos-aires-capital',
]);

export function parseAddress(address) {
  if (!address) return { city: null, province: null };

  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return { city: null, province: null };

  const last = parts[parts.length - 1];
  if (CABA_MARKERS.has(toSlug(last))) return { city: 'CABA', province: 'CABA' };

  // "calle, ciudad, provincia" → los dos ultimos segmentos.
  if (parts.length >= 3) return { city: parts[parts.length - 2], province: last };
  // "calle, ciudad" → sin provincia; el dueño la completa desde Settings.
  return { city: last, province: null };
}
