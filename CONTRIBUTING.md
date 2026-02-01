# Contributing to Sports Courts Backend

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)

## 📜 Code of Conduct

Be respectful, professional, and constructive in all interactions.

## 🚀 Getting Started

### Prerequisites

[To be updated based on chosen tech stack]

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/book-play.git
   cd book-play
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/book-play.git
   ```
4. Install dependencies:
   ```bash
   [Installation command TBD]
   ```
5. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```
6. Run database migrations:
   ```bash
   [Migration command TBD]
   ```
7. Start development server:
   ```bash
   [Start command TBD]
   ```

## 🔄 Development Workflow

### Branch Naming

Use descriptive branch names following this pattern:

```
type/short-description

Types:
- feature/  : New features
- fix/      : Bug fixes
- docs/     : Documentation changes
- refactor/ : Code refactoring
- test/     : Adding tests
- chore/    : Maintenance tasks
```

Examples:

```
feature/availability-calculation
fix/booking-overlap-validation
docs/api-endpoints
refactor/user-service
```

### Staying Up to Date

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream main into your local main
git checkout main
git merge upstream/main

# Rebase your feature branch
git checkout feature/your-feature
git rebase main
```

## 💻 Coding Standards

### General Principles

1. **KISS (Keep It Simple, Stupid)**: Favor simplicity over cleverness
2. **DRY (Don't Repeat Yourself)**: Extract common logic
3. **YAGNI (You Aren't Gonna Need It)**: Don't build for hypothetical future needs
4. **Separation of Concerns**: Keep layers distinct (API, Service, Repository)

### Code Style

[To be determined based on language/framework]

**General guidelines**:

- Use meaningful variable and function names
- Write self-documenting code
- Add comments for complex business logic only
- Keep functions small and focused (single responsibility)
- Maximum file size: ~300 lines (guideline, not hard rule)

### Project Structure

```
src/
├── api/           # HTTP layer (routes, controllers)
├── services/      # Business logic
├── repositories/  # Data access
├── models/        # Data models/entities
├── middleware/    # Express/framework middleware
├── utils/         # Utility functions
├── config/        # Configuration
└── types/         # TypeScript types (if applicable)
```

**Layer responsibilities**:

- **API**: Handle HTTP, validate input, call services
- **Services**: Implement business rules, coordinate operations
- **Repositories**: Database queries only, no business logic
- **Models**: Entity definitions, no behavior

### Error Handling

```typescript
// Example (adapt to your language)

// Custom error types
class ValidationError extends Error {
  statusCode = 400;
}

class NotFoundError extends Error {
  statusCode = 404;
}

class ForbiddenError extends Error {
  statusCode = 403;
}

// Service layer
if (!booking) {
  throw new NotFoundError("Booking not found");
}

// API layer catches and returns appropriate HTTP response
```

### Database Queries

- Use parameterized queries (prevent SQL injection)
- Use transactions for multi-step operations
- Add proper indexes
- Avoid N+1 queries
- Use connection pooling

## 📝 Commit Guidelines

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

**Examples**:

```
feat(booking): add cancellation endpoint

fix(availability): correct exception rule priority

docs(readme): update installation instructions

test(booking): add overlap validation tests
```

### Commit Best Practices

- One logical change per commit
- Write clear, concise messages
- Use present tense ("add feature" not "added feature")
- Reference issue numbers when applicable: `fix(auth): handle token expiration (#123)`

## 🧪 Testing Requirements

### Test Coverage

Minimum coverage requirements:

- **Unit tests**: 80% coverage for business logic
- **Integration tests**: All API endpoints
- **Critical paths**: 100% coverage (booking creation, availability calculation, permissions)

### Running Tests

```bash
# All tests
[Test command TBD]

# Unit tests only
[Unit test command TBD]

# Integration tests only
[Integration test command TBD]

# With coverage
[Coverage command TBD]
```

### Writing Tests

**Unit Test Example**:

```typescript
describe('BookingService', () => {
  describe('createBooking', () => {
    it('should create booking when slot is available', async () => {
      // Arrange
      const mockData = { ... };

      // Act
      const result = await bookingService.createBooking(mockData);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('ACTIVE');
    });

    it('should throw error when slot is already booked', async () => {
      // Arrange
      const overlappingBooking = { ... };

      // Act & Assert
      await expect(
        bookingService.createBooking(overlappingBooking)
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

**Integration Test Example**:

```typescript
describe("POST /api/bookings", () => {
  it("should create booking successfully", async () => {
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${validToken}`)
      .send({
        courtId: "court-1",
        date: "2024-12-15",
        startTime: "19:00",
        endTime: "20:00",
      });

    expect(response.status).toBe(201);
    expect(response.body.booking).toBeDefined();
  });
});
```

### Test Organization

```
tests/
├── unit/
│   ├── services/
│   ├── repositories/
│   └── utils/
├── integration/
│   └── api/
└── fixtures/
    └── test-data.ts
```

## 🔍 Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated (if needed)
- [ ] No console.log or debug code left
- [ ] Branch is up to date with main

### PR Title Format

```
[Type] Brief description

Examples:
[Feature] Add booking cancellation endpoint
[Fix] Correct availability calculation for exceptions
[Docs] Update API documentation
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Related Issue

Fixes #123

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

### Review Process

1. Submit PR
2. Automated checks run (CI/CD)
3. Code review by maintainer(s)
4. Address feedback
5. Approval
6. Merge

### Merge Strategy

- **Squash and merge** for feature branches
- Keep main branch history clean
- Delete branch after merge

## 🎯 Areas for Contribution

### Good First Issues

Look for issues tagged with:

- `good-first-issue`
- `help-wanted`
- `documentation`

### High Priority Areas

1. **Core functionality**: Booking system, availability calculation
2. **Testing**: Increase test coverage
3. **Documentation**: API docs, setup guides
4. **Performance**: Query optimization, caching
5. **Security**: Input validation, authentication

## 📚 Additional Resources

- [Project Documentation](./docs/)
- [Business Rules](./docs/business-rules.md)
- [Data Models](./docs/models/README.md)
- [API Documentation](./docs/api/README.md)
- [Architecture Decisions](./docs/architecture/README.md)

## ❓ Questions?

If you have questions:

1. Check existing documentation
2. Search existing issues
3. Create a new issue with the `question` label

## 🙏 Thank You!

Your contributions help make this project better for everyone!
