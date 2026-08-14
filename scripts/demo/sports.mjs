// Espejo de src/common/enums/sport.enum.ts para los scripts de mantenimiento.
// Duplicado a proposito: importar TS desde un .mjs obliga a un build, y estos
// scripts no deberian depender de dist/. Si cambia el enum, cambia aca.

export const SPORTS = [
  'futbol5',
  'futbol7',
  'futbol11',
  'futsal',
  'futbol-playa',
  'padel',
  'tenis',
  'basquet',
  'voley',
  'beach-voley',
  'handbol',
  'hockey',
  'squash',
  'otro',
];

const ALIASES = {
  'futbol-5': 'futbol5',
  'football-5': 'futbol5',
  f5: 'futbol5',
  'futbol-7': 'futbol7',
  f7: 'futbol7',
  'futbol-11': 'futbol11',
  f11: 'futbol11',
  futbol: 'futbol11',
  'fut-sal': 'futsal',
  'futbol-sala': 'futsal',
  'beach-futbol': 'futbol-playa',
  'futbol-de-playa': 'futbol-playa',
  paddle: 'padel',
  padle: 'padel',
  'tenis-de-mesa': 'otro',
  basket: 'basquet',
  basketball: 'basquet',
  basquetbol: 'basquet',
  volley: 'voley',
  volleyball: 'voley',
  voleibol: 'voley',
  'beach-volley': 'beach-voley',
  'voley-playa': 'beach-voley',
  handball: 'handbol',
  balonmano: 'handbol',
};

export const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function normalizeSport(raw) {
  if (!raw || !raw.trim()) return null;
  const slug = slugify(raw);
  if (SPORTS.includes(slug)) return slug;
  if (ALIASES[slug]) return ALIASES[slug];
  return SPORTS.find((s) => slug.startsWith(s)) ?? 'otro';
}
