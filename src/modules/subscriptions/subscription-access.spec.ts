import { SubscriptionStatus } from '../../common/enums';
import {
  DAY_MS,
  PAST_DUE_GRACE_DAYS,
  isReadOnly,
  resolveAccess,
  resolveExpiresAt,
} from './subscription-access';

const NOW = new Date('2026-07-28T12:00:00.000Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const build = (overrides: Partial<Parameters<typeof resolveExpiresAt>[0]>) => ({
  status: SubscriptionStatus.ACTIVE,
  trialEndsAt: daysFromNow(30),
  currentPeriodEnd: daysFromNow(30),
  pastDueAt: null,
  ...overrides,
});

describe('resolveExpiresAt', () => {
  it('uses trialEndsAt while trialing', () => {
    const trialEndsAt = daysFromNow(4);
    expect(
      resolveExpiresAt(
        build({ status: SubscriptionStatus.TRIALING, trialEndsAt }),
      ),
    ).toEqual(trialEndsAt);
  });

  it('uses currentPeriodEnd while active', () => {
    const currentPeriodEnd = daysFromNow(9);
    expect(
      resolveExpiresAt(
        build({ status: SubscriptionStatus.ACTIVE, currentPeriodEnd }),
      ),
    ).toEqual(currentPeriodEnd);
  });

  // El bug que evita: en PAST_DUE el período pago ya terminó, así que tomar
  // currentPeriodEnd daría una cuenta regresiva en negativo.
  it('uses the end of the grace window while past due', () => {
    const pastDueAt = daysFromNow(-2);
    expect(
      resolveExpiresAt(
        build({
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: daysFromNow(-2),
          pastDueAt,
        }),
      ),
    ).toEqual(new Date(pastDueAt.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS));
  });

  it('has no expiry once suspended or cancelled', () => {
    expect(
      resolveExpiresAt(build({ status: SubscriptionStatus.SUSPENDED })),
    ).toBeNull();
    expect(
      resolveExpiresAt(build({ status: SubscriptionStatus.CANCELLED })),
    ).toBeNull();
  });

  it('has no expiry when an active subscription has no period end', () => {
    expect(resolveExpiresAt(build({ currentPeriodEnd: null }))).toBeNull();
  });
});

describe('isReadOnly', () => {
  it.each([
    [SubscriptionStatus.TRIALING, false],
    [SubscriptionStatus.ACTIVE, false],
    [SubscriptionStatus.PAST_DUE, false],
    [SubscriptionStatus.SUSPENDED, true],
    [SubscriptionStatus.CANCELLED, true],
  ])('%s -> %s', (status, expected) => {
    expect(isReadOnly(status)).toBe(expected);
  });
});

describe('resolveAccess', () => {
  it('keeps full access during the past-due grace window', () => {
    const access = resolveAccess(
      build({
        status: SubscriptionStatus.PAST_DUE,
        pastDueAt: daysFromNow(-2),
      }),
      NOW,
    );
    expect(access.accessLevel).toBe('FULL');
    expect(access.daysUntilExpiry).toBe(PAST_DUE_GRACE_DAYS - 2);
  });

  it('reports read-only with no countdown once suspended', () => {
    const access = resolveAccess(
      build({ status: SubscriptionStatus.SUSPENDED }),
      NOW,
    );
    expect(access).toEqual({
      accessLevel: 'READ_ONLY',
      expiresAt: null,
      daysUntilExpiry: null,
    });
  });

  it('counts down whole days to the trial end', () => {
    const access = resolveAccess(
      build({
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: daysFromNow(10),
      }),
      NOW,
    );
    expect(access.daysUntilExpiry).toBe(10);
  });
});
