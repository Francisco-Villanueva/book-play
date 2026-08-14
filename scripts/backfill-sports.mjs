// Normaliza courts.sport_type a los slugs canonicos de src/common/enums/sport.enum.ts.
// Sin esto conviven "Padel" (panel admin) y "padel" (onboarding) como dos
// deportes distintos, y el filtro de la busqueda publica no encuentra ninguno.
//
// Escribe SOLO con --apply. Sin ese flag imprime lo que haria y no toca nada.
//
//   node scripts/backfill-sports.mjs
//   node scripts/backfill-sports.mjs --apply

import { connect, describeConnection, resolveDatabaseUrl } from './demo/db.mjs';
import { normalizeSport } from './demo/sports.mjs';

const APPLY = process.argv.includes('--apply');

async function main() {
  const url = resolveDatabaseUrl();
  console.log(`Base: ${describeConnection(url)}`);
  console.log(APPLY ? 'Modo: APLICAR CAMBIOS\n' : 'Modo: dry-run\n');

  const client = await connect(url);
  try {
    const { rows } = await client.query(
      `SELECT sport_type, COUNT(*)::int AS canchas
         FROM courts
        WHERE sport_type IS NOT NULL
        GROUP BY sport_type
        ORDER BY sport_type ASC`,
    );

    const changes = rows
      .map((r) => ({ ...r, target: normalizeSport(r.sport_type) }))
      .filter((r) => r.target !== r.sport_type);

    console.log(`Valores distintos hoy: ${rows.length}`);
    for (const r of rows) {
      const target = normalizeSport(r.sport_type);
      const mark = target === r.sport_type ? ' ' : '→';
      console.log(
        `  ${mark} ${String(r.sport_type).padEnd(20)} (${String(r.canchas).padStart(3)} canchas) ${
          target === r.sport_type ? '' : `→ ${target}`
        }`,
      );
    }

    if (!changes.length) {
      console.log('\nNada que normalizar.');
      return;
    }

    const total = changes.reduce((acc, c) => acc + c.canchas, 0);
    console.log(`\nA normalizar: ${changes.length} valores, ${total} canchas`);

    if (APPLY) {
      for (const c of changes) {
        await client.query(
          `UPDATE courts SET sport_type = $2 WHERE sport_type = $1`,
          [c.sport_type, c.target],
        );
      }
      console.log(`  ✓ ${total} canchas actualizadas`);
    } else {
      console.log('\nNada se escribio. Volve a correr con --apply.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
