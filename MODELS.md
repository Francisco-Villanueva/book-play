# Data Models Documentation

## 📋 Overview

This document describes the core entities, their attributes, relationships, and design decisions.

## 🎯 Key Design Principles

1. **Separation of Identity and Permissions**: User identity is separate from business permissions
2. **Multi-Tenant Support**: Users can belong to multiple businesses with different roles
3. **Sport Agnostic**: Domain model doesn't depend on specific sports
4. **Simplicity**: Minimal entities for MVP, extensible for future growth

---

## 🗃️ Core Entities

### User

Represents a person in the system. Exists independently of any business.

**Purpose**: Global identity across the entire SaaS platform.

**Attributes**:
```typescript
{
  id: UUID
  name: string
  email: string (unique)
  passwordHash: string
  phone?: string
  globalRole: 'MASTER' | 'PLAYER'
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Rules**:
- Global role only defines platform-level capabilities
- Does NOT define business-level permissions
- Can interact with multiple businesses
- Can book courts as a player
- Can have admin rights in specific businesses via BusinessUser

**Relationships**:
- Has many `BusinessUser` (different roles in different businesses)
- Has many `Booking` (as a player)

**Notes**:
- `MASTER` role is for SaaS administrators only
- Most users have `PLAYER` role
- Email must be unique across the entire platform
- Password stored as bcrypt/argon2 hash

---

### BusinessUser

Links a User to a Business with a specific role. This is the **source of truth** for permissions.

**Purpose**: Define what a user can do within a specific business.

**Attributes**:
```typescript
{
  id: UUID
  businessId: UUID (FK -> Business)
  userId: UUID (FK -> User)
  role: 'OWNER' | 'ADMIN' | 'STAFF'
  createdAt: timestamp
}
```

**Unique Constraint**: `(businessId, userId)` - a user can only have one role per business.

**Relationships**:
- Belongs to one `User`
- Belongs to one `Business`

**Role Permissions**:

| Action | OWNER | ADMIN | STAFF |
|--------|-------|-------|-------|
| View bookings | ✅ | ✅ | ✅ |
| Create booking (admin) | ✅ | ✅ | ✅ |
| Cancel booking | ✅ | ✅ | ✅ |
| Create/edit courts | ✅ | ✅ | ❌ |
| Create/edit availability rules | ✅ | ✅ | ❌ |
| Create/edit exception rules | ✅ | ✅ | ❌ |
| Manage users | ✅ | ✅ | ❌ |
| View billing/revenue | ✅ | ❌ | ❌ |
| Delete business | ✅ | ❌ | ❌ |
| Change business settings | ✅ | ❌ | ❌ |

**Notes**:
- This is NOT a user entity, it's a permission link
- Enables multi-business scenarios (same user, different roles)
- A user without BusinessUser entry has no admin rights in that business

---

### Business

Represents a sports complex (the tenant in multi-tenant architecture).

**Purpose**: Group courts, rules, and users under one business entity.

**Attributes**:
```typescript
{
  id: UUID
  name: string
  description?: string
  address?: string
  phone?: string
  email?: string
  timezone: string (default: 'America/Argentina/Buenos_Aires')
  slotDuration: integer (minutes, default: 60)
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Relationships**:
- Has many `Court`
- Has many `BusinessUser` (users with roles)
- Has many `AvailabilityRule`
- Has many `ExceptionRule`
- Has many `Booking` (indirect via Court)

**Notes**:
- `slotDuration` defines default booking length (e.g., 60 min, 90 min)
- Timezone important for multi-region support
- Each business is completely isolated from others

---

### Court

Represents a rentable space (soccer field, paddle court, tennis court, etc.).

**Purpose**: The actual bookable resource.

**Attributes**:
```typescript
{
  id: UUID
  businessId: UUID (FK -> Business)
  name: string
  sportType?: string (descriptive only, e.g., 'Fútbol 5', 'Pádel')
  surface?: string (e.g., 'Sintético', 'Césped', 'Cemento')
  capacity?: integer
  isIndoor: boolean
  hasLighting: boolean
  pricePerHour?: decimal
  description?: string
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Relationships**:
- Belongs to one `Business`
- Has many `Booking`
- Uses many `AvailabilityRule` (via junction table or inherited from business)
- Can be affected by `ExceptionRule`

**Notes**:
- `sportType` is metadata, doesn't affect logic
- Same court can be used for multiple sports (e.g., basketball + volleyball)
- `pricePerHour` can be overridden by time-based pricing (future feature)

---

### Booking

Represents a reservation of a court for a specific time slot.

**Purpose**: Block a court for a user at a specific time.

**Attributes**:
```typescript
{
  id: UUID
  courtId: UUID (FK -> Court)
  businessId: UUID (FK -> Business, denormalized for queries)
  userId?: UUID (FK -> User, optional for guest bookings)
  
  // Guest booking info (when userId is null)
  guestName?: string
  guestPhone?: string
  guestEmail?: string
  
  date: date
  startTime: time
  endTime: time
  
  status: 'ACTIVE' | 'CANCELLED'
  
  totalPrice?: decimal
  notes?: string
  
  createdAt: timestamp
  updatedAt: timestamp
  cancelledAt?: timestamp
}
```

**Constraints**:
- Unique: `(courtId, date, startTime, status)` where status = 'ACTIVE'
- If `userId` is null, at least one of `guestName`, `guestPhone`, or `guestEmail` is required

**Relationships**:
- Belongs to one `Court`
- Belongs to one `Business` (denormalized)
- Optionally belongs to one `User`

**States**:
- `ACTIVE`: Blocks availability
- `CANCELLED`: Does not block availability, logged for history

**Notes**:
- MVP doesn't support recurring bookings
- Bookings cannot cross midnight (startTime < endTime on same day)
- `businessId` denormalized for efficient querying

---

### AvailabilityRule

Defines when a court (or group of courts) is available for booking.

**Purpose**: Define recurring weekly availability patterns.

**Attributes**:
```typescript
{
  id: UUID
  businessId: UUID (FK -> Business)
  name: string (e.g., 'Horario Semanal', 'Fin de Semana')
  
  dayOfWeek: integer (0 = Sunday, 6 = Saturday)
  startTime: time
  endTime: time
  
  isActive: boolean
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Relationships**:
- Belongs to one `Business`
- Applies to many `Court` (via `CourtAvailability` junction table)

**Examples**:
```
Rule 1: Monday (1), 18:00-23:00
Rule 2: Tuesday (2), 18:00-23:00
...
Rule 6: Saturday (6), 10:00-22:00
Rule 7: Sunday (0), 10:00-22:00
```

**Notes**:
- Recurring weekly pattern
- Can be shared across multiple courts
- Does NOT specify dates, only day-of-week patterns
- `isActive` allows disabling without deleting

---

### ExceptionRule

Defines specific date exceptions that override AvailabilityRules.

**Purpose**: Handle holidays, special events, closures, or extended hours.

**Attributes**:
```typescript
{
  id: UUID
  businessId: UUID (FK -> Business)
  
  date: date (specific date)
  startTime?: time (null = all day affected)
  endTime?: time
  
  isAvailable: boolean (true = open special hours, false = closed)
  
  reason?: string (e.g., 'Feriado', 'Torneo especial', 'Mantenimiento')
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Relationships**:
- Belongs to one `Business`
- Applies to many `Court` (via `CourtException` junction table, or all courts if not specified)

**Logic**:
- `isAvailable = false`: Blocks all or specific times (closure)
- `isAvailable = true` with times: Opens special hours (e.g., Sunday morning normally closed, opened for tournament)
- `isAvailable = false` with no times: Entire day blocked

**Priority**: Always overrides AvailabilityRule for the specified date.

**Examples**:
```
Exception 1:
  date: 2024-12-25
  isAvailable: false
  reason: 'Navidad'
  → Entire day closed

Exception 2:
  date: 2024-12-20
  startTime: 10:00
  endTime: 14:00
  isAvailable: true
  reason: 'Torneo especial'
  → Only 10:00-14:00 available (rest of day follows normal rules or is blocked)
```

---

## 🔗 Junction Tables (Many-to-Many Relationships)

### CourtAvailability

Links courts to availability rules (many-to-many).

**Purpose**: Allow sharing rules across courts while also supporting court-specific rules.

**Attributes**:
```typescript
{
  id: UUID
  courtId: UUID (FK -> Court)
  availabilityRuleId: UUID (FK -> AvailabilityRule)
  createdAt: timestamp
}
```

**Unique**: `(courtId, availabilityRuleId)`

---

### CourtException (Optional, for targeted exceptions)

Links exceptions to specific courts.

**Purpose**: Apply exception to specific courts instead of all courts in business.

**Attributes**:
```typescript
{
  id: UUID
  courtId: UUID (FK -> Court)
  exceptionRuleId: UUID (FK -> ExceptionRule)
  createdAt: timestamp
}
```

**Note**: If no entries exist for an ExceptionRule, it applies to ALL courts in the business.

---

## 📊 Entity Relationships Diagram

```
User (1) ──< BusinessUser (N) >── (1) Business
 │                                      │
 │                                      ├─< Court (N)
 │                                      │     │
 │                                      │     └─< Booking (N)
 │                                      │
 └──────────────────< Booking (N)      │
                                        │
                                        ├─< AvailabilityRule (N)
                                        │          │
                                        │          └──< CourtAvailability >──┐
                                        │                                    │
                                        └─< ExceptionRule (N)                │
                                                   │                         │
                                                   └──< CourtException >─────┘
                                                                             │
                                                                          Court
```

**Legend**:
- `──<` One-to-Many
- `>──` Many-to-One
- `>──<` Many-to-Many (via junction table)

---

## 🎯 Key Scenarios

### Scenario 1: User with Multiple Roles

**Setup**:
```
User: Juan (id: user-123)
Business A: "Complejo Norte" (id: biz-a)
Business B: "Complejo Sur" (id: biz-b)

BusinessUser entries:
  { userId: user-123, businessId: biz-a, role: 'OWNER' }
  { userId: user-123, businessId: biz-b, role: 'STAFF' }
```

**Result**:
- Juan has full control over "Complejo Norte"
- Juan can only view/manage bookings in "Complejo Sur"

---

### Scenario 2: Shared Availability Rules

**Setup**:
```
Business: "Complejo Deportivo"
Courts: Cancha 1, Cancha 2, Cancha 3, Cancha 4, Cancha 5
AvailabilityRule: "Horario Estándar"
  - Monday-Friday 18:00-23:00
  - Saturday-Sunday 10:00-22:00

CourtAvailability:
  { courtId: cancha-1, availabilityRuleId: rule-std }
  { courtId: cancha-2, availabilityRuleId: rule-std }
  { courtId: cancha-3, availabilityRuleId: rule-std }
  { courtId: cancha-4, availabilityRuleId: rule-std }
  { courtId: cancha-5, availabilityRuleId: rule-std }
```

**Result**: All 5 courts share the same schedule. Updating the rule updates all courts.

---

### Scenario 3: Holiday Exception

**Setup**:
```
Business: "Complejo Deportivo"
AvailabilityRule: Monday 18:00-23:00 (normal)
ExceptionRule:
  date: 2024-12-25
  isAvailable: false
  reason: 'Navidad'
```

**Result**: On December 25 (Monday), the complex is closed despite normal Monday availability.

---

### Scenario 4: Guest Booking

**Setup**:
```
Court: Cancha 1
User: (none)
Booking:
  courtId: cancha-1
  userId: null
  guestName: 'Carlos Pérez'
  guestPhone: '+54 9 291 555-1234'
  date: 2024-12-15
  startTime: 19:00
  endTime: 20:00
  status: 'ACTIVE'
```

**Result**: Booking blocks the time slot. No user account required.

---

## 🚀 Database Considerations

### Indexes

**Critical indexes** for performance:

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);

-- Business user permissions
CREATE INDEX idx_business_users_user ON business_users(user_id);
CREATE INDEX idx_business_users_business ON business_users(business_id);

-- Court queries
CREATE INDEX idx_courts_business ON courts(business_id);

-- Booking availability checks
CREATE INDEX idx_bookings_court_date ON bookings(court_id, date, status);
CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);

-- Availability rules
CREATE INDEX idx_availability_rules_business ON availability_rules(business_id);
CREATE INDEX idx_court_availability_court ON court_availability(court_id);

-- Exception rules
CREATE INDEX idx_exception_rules_business_date ON exception_rules(business_id, date);
```

### Constraints

**Critical database constraints**:

```sql
-- Unique email
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- One role per user per business
ALTER TABLE business_users 
  ADD CONSTRAINT business_users_unique UNIQUE (business_id, user_id);

-- No overlapping active bookings
CREATE UNIQUE INDEX idx_bookings_no_overlap 
  ON bookings(court_id, date, start_time) 
  WHERE status = 'ACTIVE';
```

---

## 📝 Future Extensions (Post-MVP)

### Payment Entity
```typescript
{
  id: UUID
  bookingId: UUID
  amount: decimal
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  paymentMethod: string
  transactionId?: string
}
```

### Notification Entity
```typescript
{
  id: UUID
  userId: UUID
  type: 'EMAIL' | 'SMS' | 'PUSH'
  content: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  sentAt?: timestamp
}
```

### RecurringBooking
```typescript
{
  id: UUID
  userId: UUID
  courtId: UUID
  frequency: 'WEEKLY' | 'MONTHLY'
  dayOfWeek: integer
  startTime: time
  endDate: date
}
```

---

## 📚 Related Documentation

- [Business Rules](../business-rules.md)
- [API Documentation](../api/README.md)
- [Architecture Decisions](../architecture/README.md)
