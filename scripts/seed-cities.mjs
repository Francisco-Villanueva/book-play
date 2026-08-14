#!/usr/bin/env node
// Siembra 9 complejos demo en 3 ciudades (un padel, un futbol y un basquet en
// cada una) para probar la busqueda publica con variedad real.
//
//   node scripts/seed-cities.mjs              # dry-run: muestra y no escribe
//   node scripts/seed-cities.mjs --apply
//   node scripts/seed-cities.mjs --apply --skip-geocode
//
// Todo queda marcado con el dominio DEMO_TAG y se borra con clean-demo.mjs.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { connect, describeConnection, resolveDatabaseUrl } from './demo/db.mjs';
import { DEMO_PASSWORD, DEMO_TAG } from './demo/dataset.mjs';
import { BUSINESSES, CITIES } from './demo/cities-dataset.mjs';
import { toSlug } from './demo/location.mjs';

const APPLY = process.argv.includes('--apply');
const SKIP_GEOCODE = process.argv.includes('--skip-geocode');

const HORIZON_DAYS = 7;
const MIN_INTERVAL_MS = 1100;
const uuid = () => crypto.randomUUID();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Aleatoriedad reproducible: dos corridas dan la misma agenda, asi comparar
// resultados entre ejecuciones tiene sentido.
function makeRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

function isoPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// El cierre a medianoche o mas alla se recorta a 23:59: BR-023 prohibe que una
// reserva cruce el dia, y la grilla se corta sola en el ultimo turno completo.
function normalizeEnd(end) {
  const min = toMin(end);
  return min === 0 || min < toMin('06:00') ? 24 * 60 - 1 : min;
}

async function geocode(business) {
  const cityInfo = CITIES.find((c) => c.city === business.city);
  const q = [business.address, business.city, cityInfo?.province, 'Argentina']
    .filter(Boolean)
    .join(', ');
  const url = new URL('/search', 'https://nominatim.openstreetmap.org');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ar');
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BookAndPlay/1.0 (+https://bookandplay.app)',
        'Accept-Language': 'es',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const [first] = await res.json();
    if (!first?.lat || !first?.lon) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch {
    return null;
  }
}

function buildRows(now, hash) {
  const users = [];
  const businesses = [];
  const businessUsers = [];
  const subscriptions = [];
  const courts = [];
  const rules = [];
  const courtAvailability = [];
  const bookings = [];

  for (const [i, spec] of BUSINESSES.entries()) {
    const cityInfo = CITIES.find((c) => c.city === spec.city);
    const businessId = uuid();
    const rand = makeRandom(1000 + i * 97);

    const ownerId = uuid();
    users.push({
      id: ownerId,
      name: `Dueño ${spec.name}`,
      userName: `${spec.slug}-owner`,
      email: `owner-${spec.slug}@${DEMO_TAG}`,
      password: hash,
      phone: spec.phone,
      global_role: 'PLAYER',
      createdAt: now,
      updatedAt: now,
    });

    businesses.push({
      id: businessId,
      name: spec.name,
      description: spec.description,
      address: spec.address,
      city: spec.city,
      city_slug: cityInfo.citySlug,
      province: cityInfo.province,
      is_listed: true,
      phone: spec.phone,
      // El dominio con subdominio es lo que matchea clean-demo.mjs.
      email: `hola@${spec.slug}.${DEMO_TAG}`,
      timezone: 'America/Argentina/Buenos_Aires',
      slot_duration: spec.slotDuration,
      default_price_per_slot: spec.pricePerSlot,
      cancellation_deadline_hours: 24,
      created_at: now,
      updated_at: now,
    });

    businessUsers.push({
      id: uuid(),
      business_id: businessId,
      user_id: ownerId,
      role: 'OWNER',
      created_at: now,
      updated_at: now,
    });

    subscriptions.push({
      id: uuid(),
      business_id: businessId,
      status: 'ACTIVE',
      trial_started_at: now,
      trial_ends_at: now,
      current_period_start: now,
      current_period_end: new Date(now.getTime() + 30 * 86400000),
      created_at: now,
      updated_at: now,
    });

    const myCourts = spec.courts.map((c) => {
      const row = {
        id: uuid(),
        business_id: businessId,
        name: c.name,
        sport_type: c.sport,
        surface: c.surface ?? null,
        capacity: c.sport === 'padel' ? 4 : c.sport === 'basquet' ? 10 : 10,
        is_indoor: c.indoor ?? false,
        has_lighting: true,
        slot_duration: spec.slotDuration,
        price_per_hour: c.price ?? spec.pricePerSlot,
        description: c.description ?? null,
        is_active: c.active ?? true,
        created_at: now,
        updated_at: now,
      };
      courts.push(row);
      return row;
    });

    for (const [days, start, end] of spec.openings) {
      for (const dow of days) {
        const ruleId = uuid();
        rules.push({
          id: ruleId,
          business_id: businessId,
          name: `${spec.name} — día ${dow}`,
          day_of_week: dow,
          start_time: start,
          end_time: toTime(normalizeEnd(end)),
          is_active: true,
          created_at: now,
          updated_at: now,
        });
        for (const court of myCourts) {
          courtAvailability.push({
            id: uuid(),
            court_id: court.id,
            availability_rule_id: ruleId,
            created_at: now,
          });
        }
      }
    }

    // Reservas para que los complejos no queden todos con la agenda vacia.
    if (spec.ocupacion > 0) {
      for (let day = 0; day < HORIZON_DAYS; day++) {
        const date = isoPlus(day);
        const dow = new Date(date + 'T12:00:00').getDay();
        const opening = spec.openings.find(([days]) => days.includes(dow));
        if (!opening) continue;

        const [, start, end] = opening;
        const from = toMin(start);
        const to = normalizeEnd(end);

        for (const court of myCourts) {
          if (!court.is_active) continue;
          for (let t = from; t + spec.slotDuration <= to; t += spec.slotDuration) {
            if (rand() > spec.ocupacion) continue;
            bookings.push({
              id: uuid(),
              court_id: court.id,
              business_id: businessId,
              user_id: null,
              guest_name: 'Cliente demo',
              guest_phone: '+540000000000',
              guest_email: null,
              date,
              start_time: toTime(t),
              end_time: toTime(t + spec.slotDuration),
              status: 'ACTIVE',
              total_price: court.price_per_hour,
              payment_status: 'UNPAID',
              created_at: now,
              updated_at: now,
            });
          }
        }
      }
    }
  }

  return {
    users,
    businesses,
    businessUsers,
    subscriptions,
    courts,
    rules,
    courtAvailability,
    bookings,
  };
}

async function insertRows(client, table, rows, quotedColumns = new Set()) {
  if (!rows.length) return 0;
  const keys = Object.keys(rows[0]);
  const columnList = keys
    .map((k) => (quotedColumns.has(k) ? `"${k}"` : `"${k}"`))
    .join(', ');
  const chunkSize = Math.max(1, Math.floor(50000 / keys.length));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params = [];
    const tuples = chunk.map((row) => {
      const placeholders = keys.map((k) => {
        params.push(row[k] === undefined ? null : row[k]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO "${table}" (${columnList}) VALUES ${tuples.join(', ')}`,
      params,
    );
    inserted += chunk.length;
  }
  return inserted;
}

async function main() {
  const url = resolveDatabaseUrl();
  console.log(`Base: ${describeConnection(url)}`);
  console.log(APPLY ? 'Modo: APLICAR CAMBIOS\n' : 'Modo: dry-run\n');

  const now = new Date();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const data = buildRows(now, hash);

  for (const cityInfo of CITIES) {
    const list = BUSINESSES.filter((b) => b.city === cityInfo.city);
    console.log(`${cityInfo.city} (${cityInfo.province})`);
    for (const b of list) {
      const deportes = [...new Set(b.courts.map((c) => c.sport))].join(', ');
      console.log(
        `  ${b.name.padEnd(24)} ${String(b.courts.length).padStart(2)} canchas | ${deportes.padEnd(16)} | $${b.pricePerSlot} | ${
          b.openings.length ? 'con agenda' : 'SIN agenda (BR-009)'
        }`,
      );
    }
  }

  console.log(
    `\nFilas: ${data.businesses.length} complejos · ${data.courts.length} canchas · ` +
      `${data.rules.length} reglas · ${data.bookings.length} reservas · ${data.users.length} usuarios`,
  );

  if (!APPLY) {
    console.log('\nNada se escribio. Volve a correr con --apply.');
    return;
  }

  const client = await connect(url);
  try {
    await client.query('BEGIN');
    await insertRows(client, 'users', data.users);
    await insertRows(client, 'businesses', data.businesses);
    await insertRows(client, 'business_users', data.businessUsers);
    await insertRows(client, 'subscriptions', data.subscriptions);
    await insertRows(client, 'courts', data.courts);
    await insertRows(client, 'availability_rules', data.rules);
    await insertRows(client, 'court_availability', data.courtAvailability);
    await insertRows(client, 'bookings', data.bookings);
    await client.query('COMMIT');
    console.log('\n✓ Insertado.');

    if (SKIP_GEOCODE) {
      console.log('Geocoding salteado (--skip-geocode).');
      return;
    }

    console.log(`\nGeocoding (1 req/s, ~${BUSINESSES.length}s):`);
    for (const [i, spec] of BUSINESSES.entries()) {
      const coords = await geocode(spec);
      if (coords) {
        await client.query(
          `UPDATE businesses SET latitude = $2, longitude = $3 WHERE id = $1`,
          [data.businesses[i].id, coords.latitude, coords.longitude],
        );
        console.log(
          `  ✓ ${spec.name.padEnd(24)} ${coords.latitude}, ${coords.longitude}`,
        );
      } else {
        console.log(`  ✗ ${spec.name.padEnd(24)} sin resultados`);
      }
      await wait(MIN_INTERVAL_MS);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
});
