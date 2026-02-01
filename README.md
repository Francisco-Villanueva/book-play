# 🏟️ SaaS Sports Courts Management - Backend

Backend API for a multi-tenant SaaS platform that manages sports court rentals, replacing manual WhatsApp-based booking systems with a modern digital solution.

## 📋 Project Overview

This system allows sports complexes to digitally manage their court rentals across multiple disciplines (soccer, paddle, tennis, volleyball, basketball, etc.) through a unified, sport-agnostic platform.

### Core Problem Solved

Sports complexes currently manage bookings through:
- WhatsApp messages (lost, confusing)
- Phone calls (errors, availability unknown)
- Manual spreadsheets (duplicates, no real-time sync)

This leads to operational errors, poor user experience, and inability to scale.

### Solution

A SaaS web application that provides:
- ✅ Real-time online bookings
- ✅ Centralized reservation management
- ✅ Flexible court and schedule configuration
- ✅ Multi-tenant architecture
- ✅ Mobile-first experience
- ✅ Clear availability visibility

## 🎯 Key Design Principles

### 1. Sport Agnostic
The system is designed around **rentable spaces**, not specific sports:
- Soccer court → space with capacity 10
- Paddle court → space with capacity 4
- Volleyball court → space with capacity 12

Sport type is descriptive metadata only, not business logic.

### 2. Simplicity First
- Configuration in under 15 minutes
- Fewer steps, fewer decisions
- Competes directly with WhatsApp in ease of use
- Non-technical admin users

### 3. User Experience Priority
If the system isn't faster, clearer, and more convenient than WhatsApp, it provides no value.

## 🏗️ Architecture & Domain Model

### Core Entities

```
User
├── Identity separate from permissions
├── Can belong to multiple businesses
└── Global roles: MASTER | PLAYER

BusinessUser
├── Links User to Business with specific role
└── Roles: OWNER | ADMIN | STAFF

Business (Sports Complex)
├── Has multiple Courts
├── Defines AvailabilityRules
└── Manages ExceptionRules

Court (Rentable Space)
├── Belongs to one Business
├── Uses shared or custom rules
└── Has multiple Bookings

Booking (Reservation)
├── Reserves a time slot on a Court
├── May or may not have an associated User
└── States: ACTIVE | CANCELLED

AvailabilityRule
├── Defines recurring schedules (e.g., Mon-Fri 18:00-23:00)
└── Can apply to multiple courts

ExceptionRule
├── Defines specific date exceptions (holidays, events)
├── Always overrides AvailabilityRule
└── Can block or enable specific time slots
```

### Role System

| Role | Scope | Capabilities |
|------|-------|--------------|
| **MASTER** | Global (User.globalRole) | SaaS staff, audits all businesses |
| **PLAYER** | Global (User.globalRole) | End user, can make bookings |
| **OWNER** | Business (BusinessUser.role) | Full control, billing, delete business |
| **ADMIN** | Business (BusinessUser.role) | Manage courts, schedules, bookings |
| **STAFF** | Business (BusinessUser.role) | View agenda, create/cancel bookings |

### Multi-Business Support

Users can have different roles across different businesses:
- Juan is OWNER in his complex
- Juan is STAFF in another complex
- Juan is PLAYER when booking in other complexes

## 📐 Business Rules

### Availability Calculation

Priority order:
1. **ExceptionRule** (specific dates, highest priority)
2. **AvailabilityRule** (recurring patterns)
3. **Existing Bookings** (blocks time slots)

### Booking Rules

- ❌ No overlapping bookings on the same court
- ✅ Bookings can only be created in available time slots
- ✅ Cancelled bookings immediately free the time slot
- ✅ Duration defined by system configuration
- ✅ Guest bookings allowed (no User account required)

### Multi-Tenant Rules

- Each business is completely isolated
- No data cross-contamination between complexes
- Rules apply only within the business scope

## 🚀 MVP Scope

### ✅ Included
- Business/Complex creation
- Court management
- Schedule configuration (AvailabilityRule + ExceptionRule)
- Online booking system
- Basic admin panel
- Guest bookings (no account required)
- User authentication
- Role-based permissions

### ❌ Excluded (Future Versions)
- Native mobile apps
- Online payments/deposits
- Advanced analytics
- Automatic notifications
- Social features
- Tournaments/rankings
- AI features
- Recurring bookings
- Cancellation penalties

## 🛠️ Tech Stack

### Backend (This Repository)
- **Language**: [To be determined - Node.js/Python/Go/Java]
- **Framework**: [To be determined]
- **Database**: [To be determined - PostgreSQL/MySQL]
- **Authentication**: [To be determined - JWT/OAuth]
- **API Style**: RESTful / GraphQL [TBD]

### DevOps
- **Containerization**: Docker
- **CI/CD**: [To be determined]
- **Hosting**: [To be determined]
- **Monitoring**: [To be determined]

## 📂 Project Structure

```
.
├── docs/               # Extended documentation
│   ├── api/           # API documentation
│   ├── architecture/  # Architecture decisions
│   └── models/        # Data model diagrams
├── src/               # Source code
│   ├── core/          # Domain logic
│   ├── api/           # API endpoints
│   ├── services/      # Business services
│   ├── repositories/  # Data access layer
│   └── utils/         # Utilities
├── tests/             # Test suites
├── migrations/        # Database migrations
└── scripts/           # Development/deployment scripts
```

## 🏃 Getting Started

### Prerequisites
- [List prerequisites based on chosen tech stack]

### Installation
```bash
# Clone the repository
git clone https://github.com/[your-username]/sports-courts-backend.git
cd sports-courts-backend

# Install dependencies
[Installation commands TBD]

# Set up environment variables
cp .env.example .env

# Run migrations
[Migration commands TBD]

# Start development server
[Start commands TBD]
```

### Environment Variables
```
DATABASE_URL=
JWT_SECRET=
PORT=
NODE_ENV=
[Additional variables TBD]
```

## 🧪 Testing

```bash
# Run all tests
[Test commands TBD]

# Run unit tests
[Unit test commands TBD]

# Run integration tests
[Integration test commands TBD]

# Test coverage
[Coverage commands TBD]
```

## 📚 Documentation

Detailed documentation is available in the `/docs` folder:
- [API Reference](docs/api/README.md)
- [Data Models](docs/models/README.md)
- [Business Rules](docs/business-rules.md)
- [Architecture Decisions](docs/architecture/README.md)

## 🤝 Contributing

[Contribution guidelines TBD]

## 📝 API Endpoints (Planned)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Businesses
- `GET /api/businesses` - List businesses (filtered by user access)
- `POST /api/businesses` - Create new business
- `GET /api/businesses/:id` - Get business details
- `PUT /api/businesses/:id` - Update business
- `DELETE /api/businesses/:id` - Delete business (OWNER only)

### Courts
- `GET /api/businesses/:businessId/courts` - List courts
- `POST /api/businesses/:businessId/courts` - Create court
- `GET /api/courts/:id` - Get court details
- `PUT /api/courts/:id` - Update court
- `DELETE /api/courts/:id` - Delete court

### Availability
- `GET /api/courts/:id/availability` - Get available time slots
- `POST /api/businesses/:businessId/availability-rules` - Create rule
- `PUT /api/availability-rules/:id` - Update rule
- `DELETE /api/availability-rules/:id` - Delete rule
- `POST /api/businesses/:businessId/exception-rules` - Create exception
- `PUT /api/exception-rules/:id` - Update exception
- `DELETE /api/exception-rules/:id` - Delete exception

### Bookings
- `GET /api/bookings` - List user bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `PATCH /api/bookings/:id/cancel` - Cancel booking
- `GET /api/businesses/:businessId/bookings` - List business bookings (admin)

### Users & Permissions
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update profile
- `GET /api/businesses/:businessId/users` - List business users
- `POST /api/businesses/:businessId/users` - Add user to business
- `PUT /api/business-users/:id` - Update user role
- `DELETE /api/business-users/:id` - Remove user from business

## 🎯 Roadmap

### Phase 1: MVP (Current)
- [ ] Core domain models
- [ ] Authentication & authorization
- [ ] Business & court management
- [ ] Availability system
- [ ] Booking system
- [ ] Basic admin panel

### Phase 2: Enhancements
- [ ] Payment integration
- [ ] Email/SMS notifications
- [ ] Advanced analytics
- [ ] Mobile app API support
- [ ] Recurring bookings

### Phase 3: Growth
- [ ] WhatsApp integration
- [ ] Advanced reporting
- [ ] Multi-language support
- [ ] Custom branding per business

## 📄 License

[License TBD]

## 👥 Authors

[Author information]

## 🙏 Acknowledgments

Based on the real-world problem of sports complex management inefficiencies.

---

**Note**: This is an MVP implementation. The system is designed for simplicity and validation, not feature completeness.
