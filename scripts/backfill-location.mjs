// Completa city / city_slug / province de los complejos existentes parseando su
// `address`, y después geocodifica los que quedaron sin coordenadas.
//
// Escribe SÓLO con --apply. Sin ese flag imprime lo que haría y no toca nada:
// la base configurada suele ser la de producción.
//
//   node scripts/backfill-location.mjs                  # dry-run
//   node scripts/backfill-location.mjs --apply
//   node scripts/backfill-location.mjs --apply --skip-geocode

import {
  connect,
  describeConnection,
  loadColumns,
  resolveDatabaseUrl,
} from './demo/db.mjs';

const REQUIRED_COLUMNS = [
  'city',
  'city_slug',
  'province',
  'latitude',
  'longitude',
];

const APPLY = process.argv.includes('--apply');
const SKIP_GEOCODE = process.argv.includes('--skip-geocode');

const NOMINATIM_URL =
  process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  'BookAndPlay/1.0 (+https://bookandplay.app)';
// Límite de uso de Nominatim: 1 request por segundo, sin excepciones.
const MIN_INTERVAL_MS = 1100;

const toSlug = (value) =>
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

function parseAddress(address) {
  if (!address) return { city: null, province: null };

  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return { city: null, province: null };

  const last = parts[parts.length - 1];
  if (CABA_MARKERS.has(toSlug(last))) {
    return { city: 'CABA', province: 'CABA' };
  }

  // "calle, ciudad, provincia" → los dos últimos segmentos.
  if (parts.length >= 3) {
    return { city: parts[parts.length - 2], province: last };
  }
  // "calle, ciudad" → sin provincia; el dueño la completa desde Settings.
  return { city: last, province: null };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocode(business) {
  const q = [business.address, business.city, business.province, 'Argentina']
    .filter(Boolean)
    .join(', ');

  const url = new URL('/search', NOMINATIM_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ar');

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };

    const [first] = await response.json();
    if (!first?.lat || !first?.lon) return { error: 'sin resultados' };

    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const url = resolveDatabaseUrl();
  console.log(`Base: ${describeConnection(url)}`);
  console.log(APPLY ? 'Modo: APLICAR CAMBIOS\n' : 'Modo: dry-run\n');

  const client = await connect(url);
  try {
    // Preflight: sin la migracion aplicada, el SELECT de abajo revienta con un
    // stack trace de Postgres que no le dice a nadie que es lo que falta.
    const columns = await loadColumns(client, ['businesses']);
    const faltan = REQUIRED_COLUMNS.filter(
      (c) => !columns.get('businesses').has(c),
    );
    if (faltan.length) {
      console.error(
        `\nLa tabla "businesses" no tiene: ${faltan.join(', ')}.\n` +
          'Falta aplicar migrations/2026-08-13-business-location.sql sobre esta base.\n' +
          'Es aditiva (ADD COLUMN nullable + indices) y reejecutable:\n\n' +
          '  psql "$DATABASE_URL" -f migrations/2026-08-13-business-location.sql\n',
      );
      process.exitCode = 1;
      return;
    }

    const { rows } = await client.query(
      `SELECT id, name, address, city, city_slug, province, latitude, longitude
         FROM businesses
        ORDER BY name ASC`,
    );

    // --- Paso 1: ciudad y provincia desde el address -----------------------
    const located = [];
    for (const row of rows) {
      if (row.city) continue;
      const { city, province } = parseAddress(row.address);
      if (!city) {
        console.log(`  ⚠ ${row.name} — no se pudo parsear "${row.address}"`);
        continue;
      }
      located.push({ ...row, city, province: row.province ?? province });
    }

    console.log(`Ciudad a completar: ${located.length} de ${rows.length}`);
    for (const b of located) {
      console.log(
        `  ${b.name.padEnd(32)} → ${b.city} / ${b.province ?? '—'}  [${toSlug(b.city)}]`,
      );
    }

    if (APPLY) {
      for (const b of located) {
        await client.query(
          `UPDATE businesses
              SET city = $2, city_slug = $3, province = $4
            WHERE id = $1`,
          [b.id, b.city, toSlug(b.city), b.province],
        );
      }
      console.log(`  ✓ ${located.length} actualizados`);
    }

    // Complejos que ya tenían ciudad pero no el slug (o quedó desalineado).
    const stale = rows.filter(
      (r) => r.city && r.city_slug !== toSlug(r.city),
    );
    if (stale.length) {
      console.log(`\nSlug desalineado: ${stale.length}`);
      for (const b of stale) {
        console.log(`  ${b.name.padEnd(32)} → ${toSlug(b.city)}`);
        if (APPLY) {
          await client.query(
            `UPDATE businesses SET city_slug = $2 WHERE id = $1`,
            [b.id, toSlug(b.city)],
          );
        }
      }
    }

    // --- Paso 2: coordenadas ----------------------------------------------
    if (SKIP_GEOCODE) {
      console.log('\nGeocoding salteado (--skip-geocode).');
      return;
    }

    const byId = new Map(located.map((b) => [b.id, b]));
    const pending = rows
      .map((r) => byId.get(r.id) ?? r)
      .filter((r) => r.city && (r.latitude === null || r.longitude === null));

    console.log(
      `\nGeocoding: ${pending.length} complejos (a 1 req/s, ~${Math.ceil(
        (pending.length * MIN_INTERVAL_MS) / 1000,
      )}s)`,
    );

    for (const business of pending) {
      const result = await geocode(business);
      if (result.error) {
        console.log(`  ✗ ${business.name.padEnd(32)} ${result.error}`);
      } else {
        console.log(
          `  ✓ ${business.name.padEnd(32)} ${result.latitude}, ${result.longitude}`,
        );
        if (APPLY) {
          await client.query(
            `UPDATE businesses SET latitude = $2, longitude = $3 WHERE id = $1`,
            [business.id, result.latitude, result.longitude],
          );
        }
      }
      await wait(MIN_INTERVAL_MS);
    }

    if (!APPLY) {
      console.log('\nNada se escribió. Volvé a correr con --apply.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
