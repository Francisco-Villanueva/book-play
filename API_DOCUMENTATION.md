# API Documentation

## Overview

RESTful API for the Sports Courts Management SaaS platform.

**Base URL**: `http://localhost:3000/api/v1`

**Authentication**: JWT Bearer Token

---

## Table of Contents

1. [Authentication](#authentication)
2. [Businesses](#businesses)
3. [Courts](#courts)
4. [Availability](#availability)
5. [Bookings](#bookings)
6. [Users](#users)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

### Register

**POST** `/auth/register`

Create a new user account.

**Request Body**:
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "password": "SecurePass123!",
  "phone": "+54 9 291 555-1234"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "globalRole": "PLAYER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

**Validation Rules**:
- Email must be unique
- Password min 8 characters
- Name required

---

### Login

**POST** `/auth/login`

Authenticate and receive JWT token.

**Request Body**:
```json
{
  "email": "juan@example.com",
  "password": "SecurePass123!"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "globalRole": "PLAYER"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

**Errors**:
- `401`: Invalid credentials

---

### Refresh Token

**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body**:
```json
{
  "refreshToken": "..."
}
```

**Response** (200 OK):
```json
{
  "token": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

---

## Businesses

### List Businesses

**GET** `/businesses`

Get all businesses where the authenticated user has access.

**Headers**:
```
Authorization: Bearer {token}
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response** (200 OK):
```json
{
  "businesses": [
    {
      "id": "uuid",
      "name": "Complejo Deportivo Norte",
      "address": "Av. Colón 1234",
      "phone": "+54 291 555-0000",
      "timezone": "America/Argentina/Buenos_Aires",
      "userRole": "OWNER"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Create Business

**POST** `/businesses`

Create a new business. User becomes OWNER automatically.

**Headers**:
```
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "name": "Complejo Deportivo Sur",
  "description": "Canchas de fútbol y pádel",
  "address": "Calle Falsa 123",
  "phone": "+54 291 555-1111",
  "email": "info@complejosur.com",
  "timezone": "America/Argentina/Buenos_Aires",
  "slotDuration": 60
}
```

**Response** (201 Created):
```json
{
  "business": {
    "id": "uuid",
    "name": "Complejo Deportivo Sur",
    "createdAt": "2024-12-15T10:00:00Z"
  }
}
```

**Validation**:
- Name required, min 3 characters
- Timezone must be valid IANA timezone
- slotDuration must be 30, 60, 90, or 120 minutes

---

### Get Business Details

**GET** `/businesses/:businessId`

Get detailed information about a business.

**Response** (200 OK):
```json
{
  "business": {
    "id": "uuid",
    "name": "Complejo Deportivo Norte",
    "description": "...",
    "address": "...",
    "phone": "...",
    "email": "...",
    "timezone": "America/Argentina/Buenos_Aires",
    "slotDuration": 60,
    "courtsCount": 5,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "userRole": "OWNER"
}
```

**Permissions**: User must have access to the business

---

### Update Business

**PUT** `/businesses/:businessId`

Update business details.

**Request Body** (partial updates allowed):
```json
{
  "name": "Nuevo Nombre",
  "phone": "+54 291 555-9999"
}
```

**Response** (200 OK):
```json
{
  "business": {
    "id": "uuid",
    "name": "Nuevo Nombre",
    "updatedAt": "2024-12-15T11:00:00Z"
  }
}
```

**Permissions**: OWNER or ADMIN

---

### Delete Business

**DELETE** `/businesses/:businessId`

Permanently delete a business.

**Response** (204 No Content)

**Permissions**: OWNER only

**Note**: This will cascade delete all courts, bookings, and rules.

---

## Courts

### List Courts

**GET** `/businesses/:businessId/courts`

Get all courts for a business.

**Response** (200 OK):
```json
{
  "courts": [
    {
      "id": "uuid",
      "name": "Cancha 1 - Fútbol 5",
      "sportType": "Fútbol",
      "surface": "Sintético",
      "capacity": 10,
      "isIndoor": false,
      "hasLighting": true,
      "pricePerHour": 5000.00,
      "isActive": true
    }
  ]
}
```

---

### Create Court

**POST** `/businesses/:businessId/courts`

Create a new court.

**Request Body**:
```json
{
  "name": "Cancha 2 - Pádel",
  "sportType": "Pádel",
  "surface": "Cemento",
  "capacity": 4,
  "isIndoor": false,
  "hasLighting": true,
  "pricePerHour": 3500.00,
  "description": "Cancha profesional de pádel"
}
```

**Response** (201 Created):
```json
{
  "court": {
    "id": "uuid",
    "name": "Cancha 2 - Pádel",
    "createdAt": "2024-12-15T10:00:00Z"
  }
}
```

**Permissions**: OWNER or ADMIN

---

### Update Court

**PUT** `/courts/:courtId`

Update court details.

**Permissions**: OWNER or ADMIN

---

### Delete Court

**DELETE** `/courts/:courtId`

Delete a court.

**Response** (204 No Content)

**Permissions**: OWNER or ADMIN

**Note**: Soft delete if active bookings exist

---

## Availability

### Get Court Availability

**GET** `/courts/:courtId/availability`

Get available time slots for a court.

**Query Parameters**:
- `date` (required): Date in YYYY-MM-DD format
- `duration` (optional): Slot duration in minutes (defaults to business setting)

**Response** (200 OK):
```json
{
  "court": {
    "id": "uuid",
    "name": "Cancha 1"
  },
  "date": "2024-12-15",
  "timezone": "America/Argentina/Buenos_Aires",
  "availableSlots": [
    {
      "startTime": "18:00",
      "endTime": "19:00",
      "isAvailable": true,
      "price": 5000.00
    },
    {
      "startTime": "19:00",
      "endTime": "20:00",
      "isAvailable": false,
      "reason": "Already booked"
    },
    {
      "startTime": "20:00",
      "endTime": "21:00",
      "isAvailable": true,
      "price": 5000.00
    }
  ]
}
```

---

### Create Availability Rule

**POST** `/businesses/:businessId/availability-rules`

Define when courts are available.

**Request Body**:
```json
{
  "name": "Horario Semanal",
  "dayOfWeek": 1,
  "startTime": "18:00",
  "endTime": "23:00",
  "courtIds": ["court-uuid-1", "court-uuid-2"]
}
```

**Response** (201 Created):
```json
{
  "availabilityRule": {
    "id": "uuid",
    "name": "Horario Semanal",
    "dayOfWeek": 1,
    "startTime": "18:00",
    "endTime": "23:00",
    "isActive": true
  }
}
```

**Permissions**: OWNER or ADMIN

---

### Create Exception Rule

**POST** `/businesses/:businessId/exception-rules`

Create an exception for specific dates.

**Request Body**:
```json
{
  "date": "2024-12-25",
  "isAvailable": false,
  "reason": "Navidad - Complejo cerrado",
  "courtIds": []
}
```

**Notes**: Empty `courtIds` applies to all courts

**Response** (201 Created):
```json
{
  "exceptionRule": {
    "id": "uuid",
    "date": "2024-12-25",
    "isAvailable": false,
    "reason": "Navidad - Complejo cerrado"
  }
}
```

**Permissions**: OWNER or ADMIN

---

## Bookings

### Create Booking

**POST** `/bookings`

Create a new booking.

**Authenticated User Booking**:
```json
{
  "courtId": "uuid",
  "date": "2024-12-15",
  "startTime": "19:00",
  "endTime": "20:00",
  "notes": "Cumpleaños de Martín"
}
```

**Guest Booking** (no authentication required):
```json
{
  "courtId": "uuid",
  "date": "2024-12-15",
  "startTime": "19:00",
  "endTime": "20:00",
  "guestName": "Carlos Pérez",
  "guestPhone": "+54 9 291 555-1234",
  "guestEmail": "carlos@example.com"
}
```

**Response** (201 Created):
```json
{
  "booking": {
    "id": "uuid",
    "courtId": "uuid",
    "courtName": "Cancha 1 - Fútbol 5",
    "date": "2024-12-15",
    "startTime": "19:00",
    "endTime": "20:00",
    "status": "ACTIVE",
    "totalPrice": 5000.00,
    "createdAt": "2024-12-14T15:00:00Z"
  }
}
```

**Errors**:
- `400`: Invalid time slot
- `409`: Time slot already booked
- `422`: Court not available at requested time

---

### Get User Bookings

**GET** `/bookings`

Get bookings for authenticated user.

**Query Parameters**:
- `status` (optional): Filter by status (ACTIVE | CANCELLED)
- `from` (optional): Start date YYYY-MM-DD
- `to` (optional): End date YYYY-MM-DD

**Response** (200 OK):
```json
{
  "bookings": [
    {
      "id": "uuid",
      "court": {
        "id": "uuid",
        "name": "Cancha 1",
        "sportType": "Fútbol"
      },
      "business": {
        "id": "uuid",
        "name": "Complejo Norte"
      },
      "date": "2024-12-15",
      "startTime": "19:00",
      "endTime": "20:00",
      "status": "ACTIVE",
      "totalPrice": 5000.00,
      "createdAt": "2024-12-14T15:00:00Z"
    }
  ]
}
```

---

### Get Business Bookings (Admin)

**GET** `/businesses/:businessId/bookings`

Get all bookings for a business.

**Query Parameters**:
- `date` (optional): Filter by date
- `courtId` (optional): Filter by court
- `status` (optional): Filter by status

**Permissions**: OWNER, ADMIN, or STAFF

---

### Cancel Booking

**PATCH** `/bookings/:bookingId/cancel`

Cancel a booking.

**Response** (200 OK):
```json
{
  "booking": {
    "id": "uuid",
    "status": "CANCELLED",
    "cancelledAt": "2024-12-14T16:00:00Z"
  }
}
```

**Permissions**:
- User can cancel their own bookings
- Business staff can cancel any booking

---

## Users

### Get Current User

**GET** `/users/me`

Get authenticated user's profile.

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+54 9 291 555-1234",
    "globalRole": "PLAYER",
    "businesses": [
      {
        "id": "uuid",
        "name": "Complejo Norte",
        "role": "OWNER"
      }
    ]
  }
}
```

---

### Update Profile

**PUT** `/users/me`

Update user profile.

**Request Body**:
```json
{
  "name": "Juan Carlos Pérez",
  "phone": "+54 9 291 555-9999"
}
```

---

### Get Business Users

**GET** `/businesses/:businessId/users`

List users with access to the business.

**Response** (200 OK):
```json
{
  "users": [
    {
      "id": "uuid",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "role": "OWNER",
      "addedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Permissions**: OWNER or ADMIN

---

### Add User to Business

**POST** `/businesses/:businessId/users`

Grant a user access to the business.

**Request Body**:
```json
{
  "email": "nuevo@example.com",
  "role": "STAFF"
}
```

**Response** (201 Created):
```json
{
  "businessUser": {
    "userId": "uuid",
    "businessId": "uuid",
    "role": "STAFF"
  }
}
```

**Permissions**: OWNER or ADMIN

---

### Update User Role

**PUT** `/business-users/:businessUserId`

Change a user's role in the business.

**Request Body**:
```json
{
  "role": "ADMIN"
}
```

**Permissions**: OWNER only

---

### Remove User from Business

**DELETE** `/business-users/:businessUserId`

Remove a user's access to the business.

**Response** (204 No Content)

**Permissions**: OWNER only

**Note**: Cannot remove the last OWNER

---

## Error Handling

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate booking) |
| `UNPROCESSABLE_ENTITY` | 422 | Request understood but cannot be processed |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

---

## Rate Limiting

API requests are rate-limited to prevent abuse.

**Limits**:
- **Anonymous**: 100 requests per 15 minutes
- **Authenticated**: 1000 requests per 15 minutes

**Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1639584000
```

**Response** when limit exceeded (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "retryAfter": 900
  }
}
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Changelog

### v1.0.0 (2024-12-15)
- Initial API release
- Authentication endpoints
- Business CRUD
- Court management
- Availability system
- Booking creation and management
- User management
