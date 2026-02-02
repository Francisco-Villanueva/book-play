# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant SaaS backend API for sports court rental management ("Book & Play"). Replaces manual WhatsApp-based booking with a digital platform. Tech stack is not yet chosen — this repo currently contains only planning documentation (no source code).

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: NestJS 11
- **ORM**: Sequelize (sequelize-typescript)
- **Database**: PostgreSQL 16
- **Package manager**: pnpm
- **Containerization**: Docker + Docker Compose

## Commands

```bash
pnpm install          # Install dependencies
pnpm run build        # Compile TypeScript to dist/
pnpm run start:dev    # Start in watch mode
pnpm run start        # Start compiled app
pnpm run lint         # Run ESLint
pnpm run test         # Run unit tests
pnpm run test:e2e     # Run e2e tests
docker compose up     # Start API + PostgreSQL
docker compose up -d  # Start in background
```

## Status

**Base scaffold complete.** NestJS project initialized with empty domain modules. No entity models, controllers, or services implemented yet.

## Architecture

### Domain Model

Six core entities with strict multi-tenant isolation:

- **User** — global identity, roles: MASTER (platform admin) or PLAYER
- **BusinessUser** — links User to Business with role: OWNER > ADMIN > STAFF
- **Business** — the tenant (sports complex), completely isolated from others
- **Court** — a rentable space belonging to one Business (sport-agnostic; sport type is metadata only)
- **Booking** — reserves a time slot on a Court; states: ACTIVE | CANCELLED; guest bookings allowed (no account required)
- **AvailabilityRule** — recurring weekly schedule patterns; can apply to multiple courts
- **ExceptionRule** — date-specific overrides (holidays, events); always takes priority over AvailabilityRule

### Availability Calculation Priority

ExceptionRule > AvailabilityRule > existing Bookings

### Key Constraints

- No overlapping bookings on the same court (BR-001)
- Business data is fully isolated between tenants (BR-017)
- A user can hold different roles across different businesses

### Project Structure

```
src/
├── config/             # DB and app configuration
├── modules/            # NestJS feature modules (one per domain entity + auth)
│   ├── auth/
│   ├── users/
│   ├── businesses/
│   ├── business-users/
│   ├── courts/
│   ├── bookings/
│   ├── availability-rules/
│   └── exception-rules/
└── common/             # Shared utilities, guards, filters, decorators, interceptors
```

## Conventions

- **Branches**: `type/short-description` (e.g. `feature/availability-calculation`, `fix/booking-overlap-validation`)
- **Commits**: conventional commits — `type(scope): subject` in present tense (e.g. `feat(booking): add cancellation endpoint`)
- **PRs**: squash-and-merge, title format `[Type] Brief description`
- **Max file size guideline**: ~300 lines

## Documentation Map

- `README.md` — project overview, domain model, API endpoints, roadmap
- `API_DOCUMENTATION.md` — full REST API specification
- `MODELS.md` — detailed data models with relationships and DB design
- `business-rules.md` — 24 business rules (BR-001 through BR-024)
- `edge-cases.md` — 27 edge cases (EC-001 through EC-027)
- `ARCHITECTURE_DECISION.md` — ADR template and index
- `CONTRIBUTING.md` — workflow, coding standards, testing requirements
