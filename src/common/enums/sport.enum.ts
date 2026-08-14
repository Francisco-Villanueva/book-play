// `Court.sportType` nació como texto libre y quedó con dos vocabularios
// conviviendo: slugs del onboarding (`padel`) y labels con acento del panel
// (`Pádel`). Un filtro por deporte en la búsqueda pública es imposible así.
//
// La columna sigue siendo VARCHAR — el deporte es metadato, no dominio — pero
// desde acá se escribe siempre normalizada. El label lo pone el front.

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
] as const;

export type Sport = (typeof SPORTS)[number];

const SPORT_SET = new Set<string>(SPORTS);

// Escrituras que se vieron en datos reales y que no caen solas en su slug.
// La clave es el texto ya slugificado, así "Fútbol 5", "futbol 5" y "FUTBOL-5"
// entran todas por la misma puerta.
const ALIASES: Record<string, Sport> = {
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

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Nunca lanza: un deporte desconocido cae en `otro` antes que romper el alta de
// una cancha por un dato que es puramente descriptivo.
export function normalizeSport(raw?: string | null): Sport | null {
  if (!raw?.trim()) return null;

  const slug = slugify(raw);
  if (SPORT_SET.has(slug)) return slug as Sport;
  if (ALIASES[slug]) return ALIASES[slug];

  // "futbol5-sintetico" y parecidos: alcanza con que arranque igual.
  const prefixed = SPORTS.find((s) => slug.startsWith(s));
  return prefixed ?? 'otro';
}
