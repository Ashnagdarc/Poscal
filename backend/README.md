# Poscal Backend - NestJS API

Backend service for the Poscal trading platform built with NestJS, TypeORM, and PostgreSQL.

## Project Structure

```
backend/
├── src/
│   ├── auth/                # Authentication & authorization
│   │   ├── dto/            # Data transfer objects
│   │   ├── entities/       # User & auth entities
│   │   ├── guards/         # Auth guards
│   │   ├── strategies/     # Passport strategies
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── trading/             # Trading journal, signals, accounts
│   │   ├── services/       # Business logic
│   │   ├── controllers/    # REST endpoints
│   │   ├── entities/       # Database entities
│   │   ├── dto/            # Request/response DTOs
│   │   └── trading.module.ts
│   │
│   ├── payments/            # Payment processing (Paystack)
│   │   ├── entities/       # Payment entities
│   │   ├── dto/            # Payment DTOs
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   └── payments.module.ts
│   │
│   ├── prices/              # Real-time forex prices
│   │   ├── entities/       # Price cache entities
│   │   ├── tasks/          # Scheduled tasks
│   │   ├── prices.gateway.ts   # WebSocket gateway
│   │   ├── prices.service.ts
│   │   └── prices.module.ts
│   │
│   ├── notifications/       # Push & email notifications
│   │   ├── services/       # Notification services
│   │   ├── tasks/          # Scheduled tasks
│   │   ├── notifications.controller.ts
│   │   └── notifications.module.ts
│   │
│   ├── database/            # Database configuration
│   │   ├── migrations/     # TypeORM migrations
│   │   ├── seeds/          # Database seeders
│   │   ├── database.module.ts
│   │   └── data-source.ts
│   │
│   ├── common/              # Shared utilities
│   │   ├── guards/         # Shared guards
│   │   ├── filters/        # Exception filters
│   │   ├── interceptors/   # Request/response interceptors
│   │   └── decorators/     # Custom decorators
│   │
│   ├── app.module.ts        # Root module
│   ├── main.ts              # Application entry point
│   └── health.controller.ts # Health check endpoint
│
├── test/                    # E2E tests
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment template
├── .eslintrc.json           # ESLint configuration
├── .prettierrc.json         # Prettier configuration
├── jest.config.js           # Jest configuration
├── nest-cli.json            # NestJS CLI configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL 15.x or higher
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Environment Variables

See `.env.example` for all required environment variables:

- **Database**: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **JWT**: `JWT_SECRET`, `JWT_EXPIRATION`
- **Paystack**: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`
- **Finnhub**: `FINNHUB_API_KEY`
- **CORS**: `FRONTEND_URL`, `FRONTEND_PRODUCTION_URL`

## Running the App

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at:
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Swagger Docs**: http://localhost:3001/api/docs (when configured)

## Docker Deployment

The repo root now includes a `docker-compose.yml` that runs:

- `postgres`
- `backend`
- `poscal-price-ingestor`
- `poscal-notification-worker`

### Local Docker setup

```bash
cp backend/.env.example backend/.env
cp push-sender/.env.example push-sender/.env

docker compose up -d --build
```

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f poscal-price-ingestor
docker compose down
```

The backend container waits for PostgreSQL, runs pending migrations, and then starts NestJS.
For the root Docker stack, `DB_AUTO_BOOTSTRAP=true` is set so a fresh empty local database can be initialized from entities once before migrations run.

### Docker on a VPS

Recommended deploy loop:

```bash
git pull
docker compose up -d --build
docker compose ps
```

This is the simplest beginner-friendly workflow. Avoid trying to sync your local Docker daemon directly to the VPS for automatic live updates.

## Database Migrations

```bash
# Generate a new migration (after entity changes)
npm run migration:generate -- -n MigrationName

# Create an empty migration
npm run migration:create -- MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## API Documentation

Once the application is running, Swagger documentation is available at:
http://localhost:3001/api/docs

## Project Features

### Authentication Module
- JWT-based authentication
- Token validation
- User session management
- Password hashing with bcrypt

### Trading Module
- Trading journal CRUD operations
- Trading signals management
- Trading accounts management
- Position size calculations
- P&L tracking

### Payments Module
- Paystack webhook integration
- Payment verification
- Subscription management
- HMAC signature verification

### Prices Module
- Real-time forex price updates
- WebSocket connections for live data
- Price caching
- Integration with Finnhub API
- Scheduled price fetching

### Notifications Module
- Push notification queuing
- Email notifications
- Scheduled reminders
- Subscription expiry alerts

## Deployment

See [DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) for production deployment instructions.

## Development Guidelines

1. **Module Structure**: Each feature has its own module with controllers, services, entities, and DTOs
2. **DTOs**: Always use DTOs for request validation and response serialization
3. **Guards**: Use guards for authentication and authorization
4. **Interceptors**: Use interceptors for logging, transformation, and error handling
5. **Testing**: Write unit tests for services and E2E tests for controllers
6. **Documentation**: Document all endpoints with Swagger decorators

## Common Commands

```bash
# Start development server
npm run start:dev

# Run migrations
npm run migration:run

# Generate new module
nest g module <module-name>

# Generate new controller
nest g controller <controller-name>

# Generate new service
nest g service <service-name>

# Generate new entity
nest g class <entity-name> --no-spec
```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check connection string in `.env`
- Ensure database exists: `createdb poscal_db`

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Migration Errors
- Check entity definitions match database schema
- Verify TypeORM configuration in `data-source.ts`
- Run migrations manually: `npm run migration:run`

## License

MIT
