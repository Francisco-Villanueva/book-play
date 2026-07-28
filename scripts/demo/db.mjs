// Acceso a la base con el cliente `pg` crudo, a propósito: importar los modelos de
// Sequelize arrastra database.provider.ts, que corre sync({ alter: true }) y modificaría
// el esquema de la base apuntada. Un seed nunca debe migrar nada.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..', '..');

// Postgres devuelve DECIMAL como string para no perder precisión; en este script sólo
// se leen precios para calcular totales, así que alcanza con números.
pg.types.setTypeParser(1700, (value) => parseFloat(value));

export function resolveDatabaseUrl() {
  if (process.env.SEED_DATABASE_URL) return process.env.SEED_DATABASE_URL.trim();

  const envPath = path.join(BACKEND_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      'No se encontró back-end/.env ni la variable SEED_DATABASE_URL.',
    );
  }
  const match = fs
    .readFileSync(envPath, 'utf8')
    .match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (!match) throw new Error('back-end/.env no define DATABASE_URL.');

  return match[1].trim().replace(/^["']|["']$/g, '');
}

export function describeConnection(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}`;
}

export async function connect(url) {
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

const snake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// `users` se declara sin `underscored`, así que sus columnas son camelCase mientras que
// el resto de las tablas son snake_case. Resolver contra information_schema evita
// hardcodear esa asimetría (y sobrevive a que se normalice más adelante).
export async function loadColumns(client, tables) {
  const { rows } = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tables],
  );
  const map = new Map(tables.map((t) => [t, new Set()]));
  for (const row of rows) map.get(row.table_name)?.add(row.column_name);

  const missing = tables.filter((t) => map.get(t).size === 0);
  if (missing.length) {
    throw new Error(`Faltan tablas en la base: ${missing.join(', ')}`);
  }
  return map;
}

// Columnas cuyo nombre no es el snake_case del atributo: MODELS.md las mantiene con el
// nombre viejo para no forzar un rename destructivo bajo sync({ alter: true }).
const ALIASES = {
  courts: { pricePerSlot: 'price_per_hour' },
  businesses: { defaultSlotDuration: 'slot_duration' },
};

// Columnas que puede no tener una base sin la migración 2026-07-24 (BR-025).
const OPTIONAL = new Set([
  'paymentStatus',
  'amountPaid',
  'totalPlayers',
  'playersPaid',
  'paymentNotes',
  'paymentRecordedBy',
  'paymentRecordedAt',
]);

export function createInserter(client, columnMap) {
  return async function insertRows(table, rows) {
    if (!rows.length) return 0;

    const available = columnMap.get(table);
    const aliases = ALIASES[table] ?? {};
    const resolve = (key) =>
      [aliases[key], snake(key), key].find((c) => c && available.has(c));

    const unknown = Object.keys(rows[0]).filter(
      (k) => !resolve(k) && !OPTIONAL.has(k),
    );
    if (unknown.length) {
      throw new Error(
        `Columnas inexistentes en "${table}": ${unknown.join(', ')}`,
      );
    }

    const keys = Object.keys(rows[0]).filter((k) => resolve(k));
    const columns = keys.map(resolve);
    const columnList = columns.map((c) => `"${c}"`).join(', ');
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
  };
}
