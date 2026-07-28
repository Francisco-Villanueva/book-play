import { SubscriptionStatus } from '../../common/enums';

export const PAST_DUE_GRACE_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessLevel = 'FULL' | 'READ_ONLY';

export interface SubscriptionAccess {
  accessLevel: AccessLevel;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
}

interface AccessInput {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  pastDueAt: Date | null;
}

// The date the business actually loses access, which is NOT the same field in
// every state: in PAST_DUE the paid period is already over, so what matters is
// when the 7-day grace runs out — using currentPeriodEnd there would render a
// countdown in negative days.
export function resolveExpiresAt(subscription: AccessInput): Date | null {
  switch (subscription.status) {
    case SubscriptionStatus.TRIALING:
      return subscription.trialEndsAt;
    case SubscriptionStatus.ACTIVE:
      return subscription.currentPeriodEnd;
    case SubscriptionStatus.PAST_DUE:
      return subscription.pastDueAt
        ? new Date(
            subscription.pastDueAt.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS,
          )
        : null;
    default:
      return null;
  }
}

export function isReadOnly(status: SubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.CANCELLED
  );
}

export function resolveAccess(
  subscription: AccessInput,
  now: Date = new Date(),
): SubscriptionAccess {
  const expiresAt = resolveExpiresAt(subscription);
  return {
    accessLevel: isReadOnly(subscription.status) ? 'READ_ONLY' : 'FULL',
    expiresAt,
    daysUntilExpiry: expiresAt
      ? Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)
      : null,
  };
}
