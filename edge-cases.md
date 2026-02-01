# Edge Cases & Limit Situations

## 📋 Overview

This document identifies unusual, exceptional, or conflicting situations the system must handle correctly. Not all cases are implemented in the MVP, but they're documented to avoid incorrect design decisions.

---

## ⏰ Availability Edge Cases

### EC-001: Completely Closed Day

**Scenario**:
- Base AvailabilityRule: Court available Monday 18:00-23:00
- ExceptionRule: Monday 2024-12-25, isAvailable = false (holiday)

**Expected Behavior**:
- No time slots shown for that Monday
- Booking attempts rejected with clear message
- Existing bookings (if any) remain valid

**Implementation**:
```typescript
if (exceptionRule.isAvailable === false && !hasTimeRange) {
  return []; // No availability
}
```

---

### EC-002: Special Hours Outside Normal Schedule

**Scenario**:
- Base: No AvailabilityRule for Sunday
- ExceptionRule: Sunday 2024-12-24, 10:00-14:00, isAvailable = true (tournament)

**Expected Behavior**:
- Only 10:00-14:00 available on that Sunday
- No other times shown
- After 14:00, availability reverts to base (none)

**Implementation**:
```typescript
if (exceptionRule && exceptionRule.isAvailable) {
  return calculateSlotsFromException(exceptionRule);
}
return calculateSlotsFromAvailabilityRules(availabilityRules);
```

---

### EC-003: Multiple Overlapping Exceptions (Future)

**Scenario** (NOT in MVP):
- Exception 1: Dec 20, 10:00-14:00, available
- Exception 2: Dec 20, 12:00-16:00, available

**Expected Behavior (MVP)**:
- System prevents creating overlapping exceptions
- Validation error on creation

**Future Enhancement**:
- Merge exceptions
- Or apply most restrictive rule

---

### EC-004: Changing Rules with Existing Bookings

**Scenario**:
- AvailabilityRule: Monday-Friday 18:00-23:00
- Existing Booking: Wednesday Dec 20, 19:00-20:00
- Admin changes rule to: Monday-Friday 20:00-23:00 (starts later now)

**Expected Behavior**:
- Existing booking remains valid
- New bookings only allowed from 20:00 onwards
- No retroactive cancellation

**Implementation**:
- Rule changes only affect future availability calculations
- Bookings are immutable unless explicitly cancelled

---

### EC-005: No Availability Rules Assigned

**Scenario**:
- Court created but no AvailabilityRule linked

**Expected Behavior**:
- Court is NOT bookable
- Availability query returns empty array
- Clear error message when attempting to book

**Implementation**:
```typescript
if (!court.availabilityRules || court.availabilityRules.length === 0) {
  return {
    available: false,
    reason: 'Court has no availability schedule configured'
  };
}
```

---

## 📅 Booking Edge Cases

### EC-006: Simultaneous Booking Attempts

**Scenario**:
- User A and User B attempt to book the same slot within milliseconds

**Expected Behavior**:
- Only one booking succeeds (first transaction to commit)
- Second attempt gets clear error: "Time slot already booked"
- No double-booking

**Implementation**:
- Database unique constraint on `(court_id, date, start_time)` where status = 'ACTIVE'
- Transaction isolation level: READ COMMITTED or higher
- Retry logic with exponential backoff

---

### EC-007: Cancelled and Immediately Re-booked

**Scenario**:
1. User A cancels booking for Monday 19:00-20:00
2. User B immediately books the same slot

**Expected Behavior**:
- Cancellation marks booking as 'CANCELLED' instantly
- Slot becomes available in real-time
- User B's booking succeeds
- No race condition

**Implementation**:
```typescript
// Cancellation
UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW()
WHERE id = :id;

// Availability check excludes cancelled bookings
SELECT * FROM bookings 
WHERE court_id = :courtId 
  AND date = :date 
  AND start_time < :endTime 
  AND end_time > :startTime
  AND status = 'ACTIVE'; -- Only active bookings block
```

---

### EC-008: Booking Across Midnight (MVP: Not Allowed)

**Scenario**:
- User attempts to book from 23:00 to 01:00 (crosses midnight)

**Expected Behavior (MVP)**:
- Request rejected
- Error: "Bookings cannot cross midnight"

**Future Enhancement**:
- Support overnight bookings
- Store as two separate bookings or use datetime ranges

**Implementation**:
```typescript
if (endTime <= startTime) {
  throw new ValidationError('End time must be after start time on the same day');
}
```

---

### EC-009: Booking in the Past

**Scenario**:
- User tries to book yesterday's slot

**Expected Behavior**:
- Request rejected
- Error: "Cannot book in the past"

**Implementation**:
```typescript
if (bookingDate < today) {
  throw new ValidationError('Booking date must be today or in the future');
}
```

---

### EC-010: Guest Booking Missing Contact Info

**Scenario**:
- Guest booking with no name, no phone, no email

**Expected Behavior**:
- Request rejected
- Error: "Guest bookings require name and at least one contact method"

**Implementation**:
```typescript
if (!userId && (!guestName || (!guestPhone && !guestEmail))) {
  throw new ValidationError(
    'Guest bookings require name and phone or email'
  );
}
```

---

## 🏟️ Court Edge Cases

### EC-011: Court Without Rules

**Scenario**:
- Court created but admin forgets to assign AvailabilityRule

**Expected Behavior**:
- Court appears in admin panel with warning
- Not visible in public booking interface
- Attempt to book shows: "This court is not available for booking"

---

### EC-012: Shared Rules Modified

**Scenario**:
- 5 courts share AvailabilityRule "Standard Hours"
- Admin modifies "Standard Hours" from 18:00-23:00 to 19:00-23:00

**Expected Behavior**:
- All 5 courts immediately reflect new hours
- Only future bookings affected
- Past bookings unaffected

---

### EC-013: Deleting a Court with Bookings

**Scenario**:
- Court has active bookings
- Admin attempts to delete court

**Expected Behavior (MVP)**:
- Soft delete: Mark court as inactive/deleted
- Existing bookings remain valid
- Court no longer available for new bookings

**Alternative (Strict)**:
- Prevent deletion if active bookings exist
- Error: "Cannot delete court with active bookings"

---

## 👥 User & Permission Edge Cases

### EC-014: User Without Permissions Accessing Business

**Scenario**:
- User tries to access admin panel for Business X
- User has no BusinessUser entry for Business X

**Expected Behavior**:
- Access denied (403 Forbidden)
- Error: "You don't have permission to access this business"

**Implementation**:
```typescript
const businessUser = await getBusinessUser(userId, businessId);
if (!businessUser) {
  throw new ForbiddenError('Access denied');
}
```

---

### EC-015: User with Multiple Roles

**Scenario**:
- Juan is OWNER in Business A
- Juan is STAFF in Business B
- Juan books as PLAYER in Business C

**Expected Behavior**:
- Context switching works seamlessly
- Permissions correctly applied per business
- No privilege escalation across businesses

---

### EC-016: Last Owner Removed

**Scenario**:
- Business has only one OWNER
- That user is removed or downgraded to ADMIN

**Expected Behavior (Strict)**:
- Prevent removal if last owner
- Error: "Business must have at least one owner"

**Alternative (Permissive)**:
- Allow removal
- Assign automatic owner to user who created business

---

### EC-017: Owner Deletes Own Access

**Scenario**:
- Owner tries to remove themselves from the business

**Expected Behavior**:
- Allowed only if another owner exists
- Otherwise, blocked with error

---

## 🏢 Multi-Tenant Edge Cases

### EC-018: Cross-Business Booking Attempt

**Scenario**:
- User A tries to book Court 5 from Business B
- API request includes courtId from different businessId

**Expected Behavior**:
- Request rejected (validation error)
- Error: "Court does not belong to this business"

**Implementation**:
```typescript
const court = await getCourt(courtId);
if (court.businessId !== requestedBusinessId) {
  throw new ValidationError('Invalid court for this business');
}
```

---

### EC-019: Business Data Leak Prevention

**Scenario**:
- User is ADMIN in Business A
- User queries bookings endpoint with businessId of Business B

**Expected Behavior**:
- No data returned (permission check fails)
- Or returns only Business A data (filtered)

**Implementation**:
```typescript
// Get all businesses where user has access
const allowedBusinessIds = await getBusinessIdsForUser(userId);

// Filter query
const bookings = await getBookings({
  businessId: { in: allowedBusinessIds }
});
```

---

## ⚠️ Data Consistency Edge Cases

### EC-020: Orphaned Bookings (Database Integrity)

**Scenario**:
- Court is force-deleted from database (bypassing application)
- Bookings still reference deleted court

**Expected Behavior**:
- Foreign key constraint prevents deletion
- Or cascade delete bookings when court is deleted

**Implementation**:
```sql
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_court
  FOREIGN KEY (court_id) REFERENCES courts(id)
  ON DELETE CASCADE; -- or RESTRICT
```

---

### EC-021: Timezone Confusion

**Scenario**:
- Business in Buenos Aires (UTC-3)
- User books from different timezone
- Server in different timezone

**Expected Behavior (MVP)**:
- All times stored in business's timezone
- Clear communication of timezone in API
- Frontend converts to user's local time for display

**Implementation**:
```typescript
// Store date/time in business timezone
const businessTimezone = business.timezone; // 'America/Argentina/Buenos_Aires'
const bookingTime = DateTime.fromISO(inputTime, { zone: businessTimezone });
```

---

## 🚀 Performance Edge Cases

### EC-022: High-Volume Simultaneous Bookings

**Scenario**:
- Popular court during peak hours
- 50 users trying to book the same slot

**Expected Behavior**:
- Database handles concurrency correctly
- Only one booking succeeds
- Others get clear error messages quickly
- No deadlocks

**Implementation**:
- Optimistic locking or pessimistic locking
- Proper indexing on booking table
- Connection pooling

---

### EC-023: Large Business with Many Courts

**Scenario**:
- Business with 100+ courts
- Querying availability for all courts for next 7 days

**Expected Behavior**:
- Response within reasonable time (<2 seconds)
- Efficient query with proper pagination
- Caching where appropriate

**Implementation**:
- Index on (business_id, date)
- Limit results, use pagination
- Cache availability calculations

---

## 🔮 Out of Scope (Post-MVP)

These edge cases are documented but NOT handled in MVP:

### EC-024: Recurring Bookings Conflict
- User has weekly recurring booking
- Admin creates exception blocking that day
- **Future**: System should notify user and offer rescheduling

### EC-025: Payment Failure After Booking
- Booking created, payment fails
- **Future**: Auto-cancel or mark as "pending payment"

### EC-026: Waitlist for Full Slots
- All slots booked
- User wants to be notified if cancellation occurs
- **Future**: Implement waitlist feature

### EC-027: Overbooking Intentionally
- Some businesses allow slight overbooking
- **Future**: Configuration flag for overbooking tolerance

---

## ✅ Testing Checklist

Use this document to create test cases:

**Availability Tests**:
- [ ] Closed day (exception blocks all)
- [ ] Special hours (exception enables outside normal)
- [ ] No rules assigned to court
- [ ] Rule change doesn't affect existing bookings

**Booking Tests**:
- [ ] Simultaneous booking attempts (race condition)
- [ ] Cancel and immediate re-book
- [ ] Booking in the past rejected
- [ ] Booking across midnight rejected (MVP)
- [ ] Guest booking without contact info rejected

**Permission Tests**:
- [ ] User without BusinessUser cannot access business
- [ ] User with STAFF cannot create courts
- [ ] User cannot access other business's data
- [ ] Cross-business booking attempt blocked

**Data Integrity Tests**:
- [ ] Foreign key constraints work
- [ ] Unique constraints prevent duplicates
- [ ] Timezone handling correct

---

## 📚 Related Documentation

- [Business Rules](../business-rules.md)
- [Data Models](./models/README.md)
- [API Documentation](../api/README.md)
