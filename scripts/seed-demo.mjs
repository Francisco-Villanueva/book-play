#!/usr/bin/env node
// Siembra datos demo multi-tenant: 10 complejos con configuraciones distintas,
// jugadores, reservas activas/canceladas y bloqueos de horario por varios motivos.
//
//   node scripts/seed-demo.mjs [--bookings=460] [--dry-run]
//
// Usa la DATABASE_URL de back-end/.env salvo que se defina SEED_DATABASE_URL.
// Todo lo que crea queda marcado con el dominio de email demo (ver dataset.mjs) y se
// borra con scripts/clean-demo.mjs.

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import {
  connect,
  createInserter,
  describeConnection,
  loadColumns,
  resolveDatabaseUrl,
} from './demo/db.mjs';
import { normalizeSport } from './demo/sports.mjs';
import { parseAddress, toSlug } from './demo/location.mjs';
import {
  BOOKING_NOTES,
  BUSINESSES,
  CANCEL_REASONS,
  DEMO_PASSWORD,
  DEMO_TAG,
  GUESTS,
  PLAN_TIERS,
  PLAYERS,
  SUBSCRIPTION_PRESETS,
} from './demo/dataset.mjs';

const TRIAL_FEATURES = [
  'agenda_basic',
  'schedule_management',
  'manual_bookings',
  'slot_blocking',
];

const TABLES = [
  'users',
  'businesses',
  'business_users',
  'courts',
  'availability_rules',
  'court_availability',
  'exception_rules',
  'court_exceptions',
  'bookings',
  'plans',
  'subscriptions',
  'business_features',
  'payments',
];

const DAY_MS = 24 * 60 * 60 * 1000;
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;
const PAST_DAYS = 21;
const FUTURE_DAYS = 14;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const DRY_RUN = args.includes('--dry-run');
const BOOKINGS_TARGET = Number(flag('bookings', '460'));

// PRNG determinístico: dos corridas sobre la misma base producen la misma agenda.
function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0xb00c5eed);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const chance = (p) => rnd() < p;

const uuid = () => crypto.randomUUID();
const now = Date.now();
const nowDate = new Date(now);

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;

const dayISO = (offsetDays) =>
  new Date(now + offsetDays * DAY_MS + AR_OFFSET_MS).toISOString().slice(0, 10);
const dayOfWeek = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const TODAY = dayISO(0);

function slugEmail(userName) {
  return `${userName}@${DEMO_TAG}`;
}

async function main() {
  const url = resolveDatabaseUrl();
  const client = await connect(url);
  console.log(`\n▶ Base: ${describeConnection(url)}`);

  try {
    const columns = await loadColumns(client, TABLES);
    const insert = createInserter(client, columns);

    const existing = await client.query(
      `SELECT count(*)::int AS n FROM businesses WHERE email LIKE $1`,
      [`%@${DEMO_TAG}`],
    );
    if (existing.rows[0].n > 0) {
      console.error(
        `\n✖ Ya hay ${existing.rows[0].n} complejos demo en esta base.\n` +
          `  Corré primero:  node scripts/clean-demo.mjs\n`,
      );
      process.exitCode = 1;
      return;
    }

    const plans = await resolvePlans(client, insert);
    const data = buildDataset(plans);

    if (DRY_RUN) {
      printSummary(data, plans, true);
      return;
    }

    await client.query('BEGIN');
    await insert('users', data.users);
    await insert('businesses', data.businesses);
    await insert('business_users', data.businessUsers);
    await insert('courts', data.courts);
    await insert('availability_rules', data.availabilityRules);
    await insert('court_availability', data.courtAvailability);
    await insert('exception_rules', data.exceptionRules);
    await insert('court_exceptions', data.courtExceptions);
    await insert('subscriptions', data.subscriptions);
    await insert('business_features', data.features);
    await insert('payments', data.payments);
    await insert('bookings', data.bookings);
    await client.query('COMMIT');

    printSummary(data, plans, false);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

// Reutiliza los planes que ya existan en la base. Sólo crea planes demo si no hay
// ninguno, y los deja ocultos del pricing público para no tocar lo que ve un visitante.
async function resolvePlans(client, insert) {
  const { rows } = await client.query(
    `SELECT id, code, name, price_ars, feature_keys
       FROM plans WHERE is_archived = false ORDER BY price_ars ASC`,
  );

  if (rows.length === 0) {
    const created = Object.values(PLAN_TIERS).map((tier) => ({
      id: uuid(),
      name: tier.name,
      code: tier.code,
      description: tier.description,
      priceArs: tier.priceArs,
      courtsLimit: tier.courtsLimit,
      staffLimit: tier.staffLimit,
      featureKeys: JSON.stringify(tier.featureKeys),
      isPubliclyVisible: false,
      isArchived: false,
      sortOrder: tier.sortOrder,
      createdAt: nowDate,
      updatedAt: nowDate,
    }));
    if (!DRY_RUN) await insert('plans', created);
    return {
      created: true,
      basico: { id: created[0].id, priceArs: PLAN_TIERS.basico.priceArs, featureKeys: PLAN_TIERS.basico.featureKeys },
      pro: { id: created[1].id, priceArs: PLAN_TIERS.pro.priceArs, featureKeys: PLAN_TIERS.pro.featureKeys },
      full: { id: created[2].id, priceArs: PLAN_TIERS.full.priceArs, featureKeys: PLAN_TIERS.full.featureKeys },
    };
  }

  const norm = (row) => ({
    id: row.id,
    name: row.name,
    priceArs: Number(row.price_ars),
    featureKeys: Array.isArray(row.feature_keys) ? row.feature_keys : [],
  });
  const sorted = rows.map(norm);
  return {
    created: false,
    basico: sorted[0],
    pro: sorted[Math.min(1, sorted.length - 1)],
    full: sorted[sorted.length - 1],
  };
}

function buildDataset(plans) {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const users = [];
  const byUserName = new Map();

  const addUser = ({ name, userName, phone }) => {
    if (byUserName.has(userName)) return byUserName.get(userName);
    const row = {
      id: uuid(),
      name,
      userName,
      email: slugEmail(userName),
      password: passwordHash,
      phone: phone ?? null,
      globalRole: 'PLAYER',
      createdAt: new Date(now - Math.floor(rnd() * 200 + 30) * DAY_MS),
      updatedAt: nowDate,
    };
    users.push(row);
    byUserName.set(userName, row);
    return row;
  };

  const players = PLAYERS.map(addUser);

  const businesses = [];
  const businessUsers = [];
  const courts = [];
  const availabilityRules = [];
  const courtAvailability = [];
  const exceptionRules = [];
  const courtExceptions = [];
  const subscriptions = [];
  const features = [];
  const payments = [];
  const contexts = [];

  for (const spec of BUSINESSES) {
    const businessId = uuid();
    const preset = SUBSCRIPTION_PRESETS[spec.subscription](now);
    const createdAt = preset.trialStartedAt;

    // La ciudad se deriva del address para que el seed alimente la busqueda
    // publica sin tener que duplicarla en el dataset.
    const { city, province } = parseAddress(spec.address);

    businesses.push({
      id: businessId,
      name: spec.name,
      description: spec.description,
      address: spec.address,
      city,
      citySlug: city ? toSlug(city) : null,
      province,
      phone: spec.phone,
      email: `hola@${spec.slug}.${DEMO_TAG}`,
      timezone: 'America/Argentina/Buenos_Aires',
      defaultSlotDuration: spec.defaultSlotDuration,
      defaultPricePerSlot: spec.defaultPricePerSlot,
      createdAt,
      updatedAt: nowDate,
    });

    const owner = addUser(spec.owner);
    businessUsers.push({
      id: uuid(),
      businessId,
      userId: owner.id,
      role: 'OWNER',
      createdAt,
      updatedAt: nowDate,
    });
    const staffIds = [owner.id];
    for (const member of spec.team) {
      const user = addUser(member);
      staffIds.push(user.id);
      businessUsers.push({
        id: uuid(),
        businessId,
        userId: user.id,
        role: member.role,
        createdAt: new Date(createdAt.getTime() + 2 * DAY_MS),
        updatedAt: nowDate,
      });
    }

    const courtsByName = new Map();
    for (const courtSpec of spec.courts) {
      const row = {
        id: uuid(),
        businessId,
        name: courtSpec.name,
        // El dataset guarda el label legible; la columna, el slug canonico.
        sportType: normalizeSport(courtSpec.sportType),
        surface: courtSpec.surface,
        capacity: courtSpec.capacity,
        isIndoor: courtSpec.isIndoor,
        hasLighting: courtSpec.hasLighting,
        slotDuration: courtSpec.slotDuration,
        pricePerSlot: courtSpec.pricePerSlot,
        description: courtSpec.description ?? null,
        isActive: courtSpec.isActive ?? true,
        createdAt,
        updatedAt: nowDate,
      };
      courts.push(row);
      courtsByName.set(courtSpec.name, row);
    }

    const resolveCourts = (names) =>
      names ? names.map((n) => courtsByName.get(n)).filter(Boolean) : [...courtsByName.values()];

    const schedules = [];
    for (const schedule of spec.schedules) {
      const targets = resolveCourts(schedule.courts);
      for (const day of schedule.days) {
        const ruleId = uuid();
        availabilityRules.push({
          id: ruleId,
          businessId,
          name: schedule.name,
          dayOfWeek: day,
          startTime: `${schedule.startTime}:00`,
          // '24:00' es válido en TIME y es lo que produce addMinutesToTime('23:00', 60),
          // así que el último turno de la noche entra sin cruzar medianoche (BR-023).
          endTime: `${schedule.endTime}:00`,
          isActive: true,
          createdAt,
          updatedAt: nowDate,
        });
        for (const court of targets) {
          courtAvailability.push({
            id: uuid(),
            courtId: court.id,
            availabilityRuleId: ruleId,
            createdAt,
          });
        }
        schedules.push({
          day,
          startMin: toMinutes(schedule.startTime),
          endMin: toMinutes(schedule.endTime),
          courtIds: new Set(targets.map((c) => c.id)),
        });
      }
    }

    const blocks = [];
    for (const exception of spec.exceptions) {
      const exceptionId = uuid();
      const date = exception.date ?? dayISO(exception.daysFromToday);
      const targets = exception.courts ? resolveCourts(exception.courts) : null;
      exceptionRules.push({
        id: exceptionId,
        businessId,
        date,
        startTime: exception.startTime ? `${exception.startTime}:00` : null,
        endTime: exception.endTime ? `${exception.endTime}:00` : null,
        isAvailable: exception.isAvailable,
        reason: exception.reason,
        createdAt,
        updatedAt: nowDate,
      });
      if (targets) {
        for (const court of targets) {
          courtExceptions.push({
            id: uuid(),
            courtId: court.id,
            exceptionRuleId: exceptionId,
            createdAt,
          });
        }
      }
      if (!exception.isAvailable) {
        blocks.push({
          date,
          startMin: exception.startTime ? toMinutes(exception.startTime) : 0,
          endMin: exception.endTime ? toMinutes(exception.endTime) : 24 * 60,
          courtIds: targets ? new Set(targets.map((c) => c.id)) : null,
        });
      }
    }

    const subscriptionId = uuid();
    const plan = preset.tier ? plans[preset.tier] : null;
    subscriptions.push({
      id: subscriptionId,
      businessId,
      planId: plan?.id ?? null,
      status: preset.status,
      trialStartedAt: preset.trialStartedAt,
      trialEndsAt: preset.trialEndsAt,
      currentPeriodStart: preset.currentPeriodStart ?? null,
      currentPeriodEnd: preset.currentPeriodEnd ?? null,
      pastDueAt: preset.pastDueAt ?? null,
      suspendedAt: preset.suspendedAt ?? null,
      cancelledAt: preset.cancelledAt ?? null,
      lastExpiryNoticeDays: preset.lastExpiryNoticeDays ?? null,
      lastSuspendedNoticeDays: preset.lastSuspendedNoticeDays ?? null,
      createdAt: preset.trialStartedAt,
      updatedAt: nowDate,
    });

    const featureKeys = plan?.featureKeys?.length ? plan.featureKeys : TRIAL_FEATURES;
    const revoked = preset.status === 'SUSPENDED' || preset.status === 'CANCELLED';
    for (const featureKey of featureKeys) {
      features.push({
        id: uuid(),
        businessId,
        featureKey,
        isEnabled: !revoked,
        enabledBy: 'PLAN',
        enabledAt: preset.trialStartedAt,
        disabledAt: revoked ? (preset.suspendedAt ?? preset.currentPeriodEnd ?? nowDate) : null,
        notes: null,
        createdAt: preset.trialStartedAt,
        updatedAt: nowDate,
      });
    }

    for (const [index, payment] of (preset.payments ?? []).entries()) {
      const paidAt = new Date(now - payment.daysAgo * DAY_MS);
      payments.push({
        id: uuid(),
        businessId,
        subscriptionId,
        planId: plan?.id ?? null,
        mpPaymentId: `demo-${spec.slug}-${index + 1}`,
        amount: plan?.priceArs ?? 0,
        status: payment.status,
        paidAt: payment.status === 'APPROVED' ? paidAt : null,
        rawPayload: JSON.stringify({ demo: true, source: 'seed-demo' }),
        createdAt: paidAt,
        updatedAt: paidAt,
      });
    }

    contexts.push({
      spec,
      businessId,
      courts: [...courtsByName.values()],
      schedules,
      blocks,
      staffIds,
      activeUntil: preset.activeUntilDaysAgo != null ? -preset.activeUntilDaysAgo : FUTURE_DAYS,
    });
  }

  const bookings = buildBookings(contexts, players);

  return {
    users,
    businesses,
    businessUsers,
    courts,
    availabilityRules,
    courtAvailability,
    exceptionRules,
    courtExceptions,
    subscriptions,
    features,
    payments,
    bookings,
    contexts,
  };
}

function buildBookings(contexts, players) {
  const weights = contexts.map((c) => c.spec.density * c.courts.filter((x) => x.isActive).length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const bookings = [];

  contexts.forEach((context, index) => {
    const quota = Math.round(BOOKINGS_TARGET * (weights[index] / totalWeight));
    const candidates = slotCandidates(context);
    // Muestreo ponderado sin reemplazo (Efraimidis-Spirakis): concentra las reservas
    // en la franja nocturna sin dejar los horarios flojos completamente vacíos.
    const chosen = candidates
      .map((c) => ({ ...c, key: -Math.log(rnd()) / c.weight }))
      .sort((a, b) => a.key - b.key)
      .slice(0, quota);

    for (const slot of chosen) {
      bookings.push(makeBooking(context, slot, players));
    }
  });

  return bookings;
}

function slotCandidates(context) {
  const candidates = [];
  // bookings tiene un índice único parcial sobre (court_id, date, start_time) para las
  // ACTIVE: si dos reglas de disponibilidad se solapan, el mismo slot no puede salir dos veces.
  const seen = new Set();

  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset += 1) {
    if (offset > context.activeUntil) continue;
    const date = dayISO(offset);
    const weekday = dayOfWeek(date);
    const isWeekend = weekday === 0 || weekday === 6;

    for (const court of context.courts) {
      if (!court.isActive) continue;
      const windows = context.schedules.filter(
        (s) => s.day === weekday && s.courtIds.has(court.id),
      );

      for (const window of windows) {
        for (
          let startMin = window.startMin;
          startMin + court.slotDuration <= window.endMin;
          startMin += court.slotDuration
        ) {
          const endMin = startMin + court.slotDuration;
          const blocked = context.blocks.some(
            (b) =>
              b.date === date &&
              (!b.courtIds || b.courtIds.has(court.id)) &&
              startMin < b.endMin &&
              endMin > b.startMin,
          );
          if (blocked) continue;

          const key = `${court.id}|${date}|${startMin}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const hour = startMin / 60;
          let weight = 0.12;
          if (hour >= 18 && hour < 23) weight = 1;
          else if (hour >= 12 && hour < 18) weight = isWeekend ? 0.7 : 0.3;
          else if (hour >= 9 && hour < 12) weight = isWeekend ? 0.5 : 0.2;
          if (offset > 7) weight *= 0.45;

          candidates.push({ court, date, startMin, endMin, weight, offset });
        }
      }
    }
  }

  return candidates;
}

function makeBooking(context, slot, players) {
  const isPast = slot.date < TODAY;
  const cancelled = chance(0.18);
  const guest = chance(0.42);
  const price = Number(slot.court.pricePerSlot);
  const bookedAt = new Date(
    now + (slot.offset - Math.floor(rnd() * 9 + 1)) * DAY_MS,
  );

  let paymentStatus = 'UNPAID';
  let amountPaid = null;
  let totalPlayers = null;
  let playersPaid = null;

  if (cancelled) {
    if (chance(0.12)) {
      paymentStatus = 'PAID';
      amountPaid = Math.round(price * 0.5);
    }
  } else if (isPast) {
    const roll = rnd();
    if (roll < 0.74) {
      paymentStatus = 'PAID';
      amountPaid = price;
    } else if (roll < 0.9) {
      paymentStatus = 'PARTIAL';
      totalPlayers = slot.court.capacity;
      playersPaid = Math.max(1, Math.floor(slot.court.capacity * (0.3 + rnd() * 0.4)));
      amountPaid = Math.round((price / totalPlayers) * playersPaid);
    }
  } else if (chance(0.22)) {
    paymentStatus = 'PARTIAL';
    amountPaid = Math.round(price * 0.5);
    totalPlayers = slot.court.capacity;
    playersPaid = Math.ceil(slot.court.capacity / 2);
  }

  const paid = paymentStatus !== 'UNPAID';
  const guestData = guest ? pick(GUESTS) : null;
  const player = guest ? null : pick(players);

  const notes = [];
  if (chance(0.22)) notes.push(pick(BOOKING_NOTES));
  if (cancelled) notes.push(pick(CANCEL_REASONS));

  return {
    id: uuid(),
    courtId: slot.court.id,
    businessId: context.businessId,
    userId: player?.id ?? null,
    guestName: guestData?.guestName ?? null,
    guestPhone: guestData?.guestPhone ?? null,
    guestEmail: guestData?.guestEmail ?? null,
    date: slot.date,
    startTime: fromMinutes(slot.startMin),
    endTime: fromMinutes(slot.endMin),
    status: cancelled ? 'CANCELLED' : 'ACTIVE',
    totalPrice: price,
    paymentStatus,
    amountPaid,
    totalPlayers,
    playersPaid,
    paymentNotes: paymentStatus === 'PARTIAL' ? 'Pagaron una parte en el mostrador' : null,
    paymentRecordedBy: paid ? pick(context.staffIds) : null,
    paymentRecordedAt: paid ? new Date(new Date(`${slot.date}T20:00:00Z`).getTime()) : null,
    notes: notes.length ? notes.join('. ') : null,
    cancelledAt: cancelled ? new Date(bookedAt.getTime() + DAY_MS) : null,
    cancellationTokenHash:
      guest && !cancelled ? crypto.createHash('sha256').update(uuid()).digest('hex') : null,
    createdAt: bookedAt,
    updatedAt: cancelled ? new Date(bookedAt.getTime() + DAY_MS) : bookedAt,
  };
}

function printSummary(data, plans, dryRun) {
  const label = dryRun ? 'SIMULACIÓN (no se escribió nada)' : 'Datos demo creados';
  console.log(`\n✔ ${label}\n`);

  console.table(
    data.contexts.map((c) => {
      const bookings = data.bookings.filter((b) => b.businessId === c.businessId);
      const sub = data.subscriptions.find((s) => s.businessId === c.businessId);
      return {
        Complejo: c.spec.name,
        Deportes: [...new Set(c.spec.courts.map((x) => x.sportType))].join(', '),
        Canchas: c.courts.length,
        Turno: [...new Set(c.spec.courts.map((x) => `${x.slotDuration}'`))].join('/'),
        Suscripción: sub.status,
        Reservas: bookings.length,
        Canceladas: bookings.filter((b) => b.status === 'CANCELLED').length,
      };
    }),
  );

  const counts = {
    Usuarios: data.users.length,
    Complejos: data.businesses.length,
    Canchas: data.courts.length,
    'Reglas de disponibilidad': data.availabilityRules.length,
    'Bloqueos / excepciones': data.exceptionRules.length,
    Reservas: data.bookings.length,
    'Reservas de invitados': data.bookings.filter((b) => b.guestName).length,
    'Pagos de suscripción': data.payments.length,
  };
  console.log(
    Object.entries(counts)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n'),
  );

  if (plans.created) {
    console.log('\n  Se crearon 3 planes demo (ocultos del pricing público).');
  }
  console.log(
    `\n  Login de cualquier usuario demo: <usuario>@${DEMO_TAG} / ${DEMO_PASSWORD}` +
      `\n  Ej. dueño: ${slugEmail(BUSINESSES[0].owner.userName)}` +
      `\n  Ej. jugador: ${slugEmail(PLAYERS[0].userName)}` +
      `\n\n  Para borrar todo:  node scripts/clean-demo.mjs\n`,
  );
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}\n`);
  process.exitCode = 1;
});
