#!/usr/bin/env node
// Borra todo lo que creó seed-demo.mjs y nada más: se guía por el dominio de email
// demo, que ningún registro real usa.
//
//   node scripts/clean-demo.mjs [--dry-run]

import {
  connect,
  describeConnection,
  resolveDatabaseUrl,
} from './demo/db.mjs';
import { DEMO_TAG } from './demo/dataset.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const BUSINESS_EMAIL = `%@%.${DEMO_TAG}`;
const USER_EMAIL = `%@${DEMO_TAG}`;

const main = async () => {
  const url = resolveDatabaseUrl();
  const client = await connect(url);
  console.log(`\n▶ Base: ${describeConnection(url)}`);

  try {
    const { rows: businesses } = await client.query(
      `SELECT id, name FROM businesses WHERE email LIKE $1`,
      [BUSINESS_EMAIL],
    );
    const { rows: users } = await client.query(
      `SELECT id FROM users WHERE email LIKE $1`,
      [USER_EMAIL],
    );
    const businessIds = businesses.map((b) => b.id);
    const userIds = users.map((u) => u.id);

    if (!businessIds.length && !userIds.length) {
      console.log('\n  No hay datos demo para borrar.\n');
      return;
    }

    console.log(
      `\n  Complejos demo: ${businessIds.length}\n  Usuarios demo: ${userIds.length}`,
    );
    if (DRY_RUN) {
      console.log(`\n  --dry-run: no se borró nada.\n`);
      return;
    }

    await client.query('BEGIN');
    const deleted = {};
    const run = async (label, sql, params) => {
      const result = await client.query(sql, params);
      deleted[label] = result.rowCount;
    };

    // Las reservas van primero: un usuario demo puede tener reservas en un complejo
    // real (y viceversa), y ninguna de las dos debe dejar filas huérfanas.
    await run(
      'bookings',
      `DELETE FROM bookings WHERE business_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`,
      [businessIds, userIds],
    );
    // Turnos fijos y notificaciones son posteriores al seed, así que hoy no crea
    // ninguno; van igual porque cuelgan del complejo y cualquiera que aparezca
    // (un cliente que cancela genera una notificación) haría fallar el DELETE
    // de businesses por FK y volvería atrás el borrado entero.
    await run(
      'recurring_bookings',
      `DELETE FROM recurring_bookings WHERE business_id = ANY($1::uuid[])`,
      [businessIds],
    );
    await run(
      'notifications',
      `DELETE FROM notifications WHERE business_id = ANY($1::uuid[])`,
      [businessIds],
    );
    await run(
      'court_availability',
      `DELETE FROM court_availability WHERE court_id IN (SELECT id FROM courts WHERE business_id = ANY($1::uuid[]))`,
      [businessIds],
    );
    await run(
      'court_exceptions',
      `DELETE FROM court_exceptions WHERE court_id IN (SELECT id FROM courts WHERE business_id = ANY($1::uuid[]))`,
      [businessIds],
    );
    await run('courts', `DELETE FROM courts WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run('availability_rules', `DELETE FROM availability_rules WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run('exception_rules', `DELETE FROM exception_rules WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run('payments', `DELETE FROM payments WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run('business_features', `DELETE FROM business_features WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run('subscriptions', `DELETE FROM subscriptions WHERE business_id = ANY($1::uuid[])`, [businessIds]);
    await run(
      'business_users',
      `DELETE FROM business_users WHERE business_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`,
      [businessIds, userIds],
    );
    await run('businesses', `DELETE FROM businesses WHERE id = ANY($1::uuid[])`, [businessIds]);
    await run('users', `DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
    await run(
      'plans',
      `DELETE FROM plans WHERE code LIKE 'demo-%'
         AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.plan_id = plans.id)
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.plan_id = plans.id)`,
    );
    await client.query('COMMIT');

    console.log('\n✔ Borrado:\n');
    console.log(
      Object.entries(deleted)
        .map(([table, count]) => `  ${table}: ${count}`)
        .join('\n') + '\n',
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`\n✖ ${error.message}\n`);
  process.exitCode = 1;
});
