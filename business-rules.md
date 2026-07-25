# Business Rules Documentation

## 📋 Overview

This document defines the mandatory business rules that govern the system's behavior, independent of technology implementation.

## 🎯 General Principles

1. **No booking overlap**: No two active reservations can exist for the same court at the same time
2. **Dynamic availability**: Availability is calculated in real-time, not stored as fixed slots
3. **Predictable rules**: System behavior must be consistent and predictable
4. **Exceptions take priority**: ExceptionRules always override AvailabilityRules
5. **Simplicity over flexibility**: Simple, clear rules over complex edge cases (for MVP)

---

## 📅 Booking Rules

### BR-001: No Overlapping Reservations
**Rule**: Two active bookings cannot overlap on the same court.

**Validation**: Must be enforced at all times, regardless of who creates the booking (user, admin, API).

**Example**:
```
Court A - Monday 18:00-19:00 → Booking exists
Court A - Monday 18:30-19:30 → ❌ REJECTED (overlaps)
Court A - Monday 19:00-20:00 → ✅ ALLOWED (no overlap)
```

### BR-002: Booking States
**Rule**: A booking can only be in one of two states:
- `ACTIVE`: Blocks the time slot
- `CANCELLED`: Does not block availability

**Behavior**:
- Cancelled bookings are ignored in availability calculations
- Cancellation is permanent (no "undo" in MVP)

### BR-003: Booking Creation Validation
**Rule**: Bookings can only be created in available time slots.

**Requirements**:
1. Time slot must exist in AvailabilityRule OR ExceptionRule
2. No active booking exists for that slot
3. Court must exist and belong to the business
4. User must have permission (if authenticated)

### BR-004: Booking Duration
**Rule**: Booking duration is defined by the court, not by user input. Every booking on a
court spans exactly `court.slotDuration` minutes — the client sends `startTime` only and
the server derives `endTime`.

**Per-court configuration**: `Court.slotDuration` is mandatory (30 | 60 | 90 | 120). On
court creation it defaults to `business.defaultSlotDuration`; after that the two are
independent, so one court can run 90-minute turnos while the rest run 60.

**Changing it**: only affects bookings created afterwards. Existing bookings keep their
stored `startTime`/`endTime`.

**Pricing**: Because every booking is exactly one `court.slotDuration`-long turno,
`Court.pricePerSlot` is charged as-is per booking (`totalPrice = pricePerSlot`) — it is
not an hourly rate multiplied by duration. It also defaults from
`business.defaultPricePerSlot` on creation.

**Future**: Variable duration within a single court (letting the player pick 60 vs 90),
which would require revisiting the pricing rule above.

### BR-005: Guest Bookings
**Rule**: Bookings can be created without a registered user account.

**Requirements** (for guest bookings):
- Name (required)
- Phone or Email (at least one required)
- No user authentication

**Limitations**:
- Cannot view booking history
- Cannot manage bookings (admin must cancel)

---

## ⏰ Availability Rules

### BR-006: Base Availability Definition
**Rule**: Availability is defined through recurring weekly patterns (AvailabilityRule).

**Pattern**: Days of week + time ranges
```
Example:
- Monday-Friday: 18:00-23:00
- Saturday-Sunday: 10:00-22:00
```

**Note**: Availability is NOT stored as individual time slots but calculated dynamically.

### BR-007: Exception Priority
**Rule**: ExceptionRules ALWAYS take precedence over AvailabilityRules.

**Priority Order**:
1. ExceptionRule (highest)
2. AvailabilityRule
3. Existing Bookings

**Example**:
```
Base rule: Monday 18:00-23:00 available
Exception: Monday 2024-12-25 CLOSED
Result: Monday 2024-12-25 → No availability (even though it's a Monday)
```

### BR-008: Exception Types
**Rule**: Exceptions can either BLOCK or ENABLE time slots.

**Block Exception**:
- Removes availability (e.g., holiday closure)
- Overrides base availability

**Enable Exception**:
- Adds availability outside normal hours
- Useful for special events

**Example**:
```
Base: Wednesday CLOSED
Enable Exception: Wednesday 2024-12-20 10:00-14:00 OPEN
Result: Only 10:00-14:00 available on that specific Wednesday
```

### BR-009: No Availability Without Rules
**Rule**: A court with no AvailabilityRule assigned is NOT bookable.

**Behavior**: Courts must explicitly define when they're available.

---

## 🏟️ Court Rules

### BR-010: Court Ownership
**Rule**: Each court belongs to exactly one business.

**Constraints**:
- Cannot share courts between businesses
- Cannot transfer courts (delete and recreate instead, for MVP)

### BR-011: Shared Availability Rules
**Rule**: Multiple courts can share the same AvailabilityRule.

**Benefits**:
- Avoid duplicate configuration
- Update multiple courts at once

**Example**:
```
5 soccer courts with same schedule:
- Create 1 AvailabilityRule
- Assign to all 5 courts
- Changing the rule affects all courts
```

**Important**: Changes to shared rules do NOT affect existing bookings.

### BR-012: Custom Court Rules
**Rule**: Courts can have their own specific AvailabilityRules.

**Use Case**: When one court has different hours than others.

---

## 👥 User & Permission Rules

### BR-013: Role-Based Access Control
**Rule**: User permissions are determined by their BusinessUser role within each business.

**Global Roles** (User.globalRole):
- `MASTER`: SaaS admin, can audit all businesses
- `PLAYER`: Regular user, can make bookings

**Business Roles** (BusinessUser.role):
- `OWNER`: Full control, billing access, can delete business
- `ADMIN`: Manage courts, schedules, bookings (no billing)
- `STAFF`: View agenda, create/cancel bookings only

### BR-014: Multi-Business Users
**Rule**: A user can have different roles in different businesses.

**Example**:
```
User: Juan
- Complex A: OWNER
- Complex B: STAFF
- Complex C: PLAYER (just books courts)
```

### BR-015: Permission Inheritance
**Rule**: Higher roles include all permissions of lower roles.

**Hierarchy**:
```
OWNER > ADMIN > STAFF
```

**Example**: An OWNER can do everything an ADMIN can do, plus more.

### BR-016: Player Booking Permissions
**Rule**: Any authenticated user can book courts as a PLAYER, regardless of admin roles.

**Behavior**: Having an ADMIN role in one business doesn't prevent booking as a player in another.

---

## 🏢 Multi-Tenant Rules

### BR-017: Business Isolation
**Rule**: Data from one business is completely isolated from others.

**Enforced At**:
- Database level (business_id foreign keys)
- API level (permission checks)
- UI level (filtered queries)

### BR-018: No Cross-Business Operations
**Rule**: Actions in one business cannot affect another.

**Examples**:
- Bookings only visible within the business
- Rules only apply to courts in the same business
- Users in one business cannot see users in another (unless they belong to both)

---

## 🚫 MVP Simplifications

These rules are simplified for the MVP and will be enhanced in future versions:

### BR-019: No Cancellation Penalties
**Rule**: Cancelling a booking has no penalty or restrictions.

**Future**: Add cancellation policies, deadlines, or fees.

### BR-020: No Payment Integration
**Rule**: Booking confirmation does not require payment.

**Future**: Integrate online payments, deposits, or "pay at venue" tracking.

### BR-021: No Recurring Bookings
**Rule**: Each booking is a single, independent reservation.

**Future**: Allow users to book the same slot weekly/monthly.

### BR-022: No Advanced User Rules
**Rule**: All users are treated equally (no VIP, no blacklist).

**Future**: Priority booking, user tiers, loyalty programs.

### BR-023: No Midnight-Crossing Bookings
**Rule**: Bookings cannot start on one day and end on the next.

**Future**: Support overnight bookings if needed.

### BR-024: Single Exception Per Day (MVP)
**Rule**: Only one ExceptionRule can apply to a given date per court.

**Future**: Support multiple exceptions with conflict resolution.

---

### BR-025: On-Site Payment Recording
**Rule**: The payment of a booking is recorded manually by the venue staff and is
**independent of `status`**. A `CANCELLED` booking can be `PAID` (cancellation fee
already collected) and an `ACTIVE` one can stay `UNPAID`. Payment state never blocks,
conditions or invalidates BR-001 / BR-003 — it is bookkeeping, not a gate.

- **`paymentStatus` is always derived, never sent by the client**, so it can never
  contradict the player counts:
  - `playersPaid === 0` → `UNPAID`
  - `0 < playersPaid < totalPlayers` → `PARTIAL`
  - `playersPaid >= totalPlayers` → `PAID`
- `playersPaid` can never exceed `totalPlayers`; `totalPlayers >= 1`.
- A booking paid by one person is just `totalPlayers: 1` — there is no separate
  "whole booking" mode. The player count is the only unit of payment.
- `amountPaid` defaults to the list price prorated across the players who paid, which is
  how the money actually comes in at the venue. When everyone paid it records exactly
  `totalPrice` so proration rounding never drifts the revenue total.
- An explicit `amountPaid` overrides the proration. This is what keeps discounts and
  courtesy turnos representable: `PAID` with `amountPaid < totalPrice` is valid.
- Permissions: `OWNER | ADMIN | STAFF` can record a payment (same scope as creating and
  cancelling bookings). Aggregate revenue reporting stays `OWNER` only — the per-booking
  badge is operational information the front desk needs to charge.

**Not covered (BR-020 still holds)**: there is no online payment for court time. This
records money collected at the venue.

---

## ⚠️ Critical Validations

These validations MUST be enforced in the backend:

1. ✅ No overlapping active bookings
2. ✅ Booking only in available slots
3. ✅ Exception priority over availability
4. ✅ User has required permission for action
5. ✅ Court belongs to the correct business
6. ✅ Cancelled bookings don't block slots
7. ✅ Guest bookings have required contact info
8. ✅ Times don't cross midnight (MVP)

---

## 📊 Rule Application Examples

### Example 1: Normal Booking Flow
```
Business: "Complejo Deportivo Sur"
Court: "Cancha 1 - Fútbol"
AvailabilityRule: Mon-Fri 18:00-23:00

User action: Book Monday 19:00-20:00
Checks:
  ✅ AvailabilityRule allows Monday 19:00-20:00
  ✅ No existing booking at that time
  ✅ User is authenticated or provides guest info
Result: Booking created
```

### Example 2: Holiday Exception
```
Base: Monday 18:00-23:00 available
Exception: Monday 2024-12-25 CLOSED (holiday)

User action: Book Monday Dec 25, 19:00-20:00
Checks:
  ❌ ExceptionRule blocks all times on Dec 25
Result: Booking rejected
```

### Example 3: Special Event
```
Base: Wednesday CLOSED
Exception: Wednesday 2024-12-20 10:00-14:00 OPEN (tournament)

User action: Book Wednesday Dec 20, 11:00-12:00
Checks:
  ✅ ExceptionRule enables 10:00-14:00 on Dec 20
  ✅ Requested time within exception range
  ✅ No existing booking
Result: Booking created
```

### Example 4: Permission Check
```
User: Juan
Business: "Complejo Norte"
BusinessUser role: STAFF

Action: Create new court
Checks:
  ❌ STAFF cannot create courts (requires ADMIN or OWNER)
Result: Action rejected
```

---

## 🔄 Rule Change Impact

### Changing AvailabilityRule
**Impact**: Future availability only
**Existing bookings**: Unchanged

### Adding ExceptionRule
**Impact**: Blocks or enables specific dates
**Existing bookings**: Unchanged (bookings remain valid even if exception would prevent them)

### Cancelling Booking
**Impact**: Immediate
**Availability**: Slot becomes available right away

---

## 📚 Related Documentation

- [AvailabilityRule & ExceptionRule](./availability-rules.md)
- [Data Models](./models/README.md)
- [Edge Cases](./edge-cases.md)
- [API Documentation](./api/README.md)
