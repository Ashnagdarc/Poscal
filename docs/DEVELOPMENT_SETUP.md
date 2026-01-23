# Development Setup Guide

**Project**: Poscal - NestJS Backend + React Frontend  
**Last Updated**: January 23, 2026

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: v15.x or higher
- **Docker** (optional): For containerized development
- **Git**: For version control

---

## Quick Start (Local Development)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Poscal
```

### 2. Install Dependencies

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd backend
npm install
cd ..
```

### 3. Set Up PostgreSQL Database

#### Option A: Local PostgreSQL Installation

1. Install PostgreSQL:
```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
```

2. Create database and user:
```bash
sudo -u postgres psql

-- In PostgreSQL shell:
CREATE DATABASE poscal_db;
CREATE USER poscal_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE poscal_db TO poscal_user;
\q
```

#### Option B: Docker PostgreSQL

```bash
docker run --name poscal-postgres \
  -e POSTGRES_DB=poscal_db \
  -e POSTGRES_USER=poscal_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Configure Environment Variables

#### Frontend (.env.local)
Create a `.env.local` file in the project root:
```env
# API Configuration
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Payment Configuration (Paystack)
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

#### Backend (.env)
Create a `.env` file in the `backend/` folder:
```env
# Node Environment
NODE_ENV=development
PORT=3001

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=poscal_user
DB_PASSWORD=your_password
DB_NAME=poscal_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=24h

# Frontend URLs (for CORS)
FRONTEND_URL=http://localhost:5173
FRONTEND_PRODUCTION_URL=https://poscal.com

# Paystack Configuration
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key

# Finnhub API (for price data)
FINNHUB_API_KEY=your_finnhub_api_key

# Email Configuration (optional)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@poscal.com

# Push Notifications (optional)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

### 5. Run Database Migrations

```bash
cd backend
npm run migration:run
cd ..
```

### 6. Start Development Servers

#### Terminal 1 - Backend
```bash
cd backend
npm run start:dev
```

The backend will start on `http://localhost:3001`

#### Terminal 2 - Frontend
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

### 7. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **API Documentation (Swagger)**: http://localhost:3001/api/docs

---

## Project Structure

```
Poscal/
├── backend/               # NestJS backend application
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── trading/      # Trading journal, signals, accounts
│   │   ├── payments/     # Payment processing
│   │   ├── prices/       # Real-time price updates
│   │   ├── notifications/ # Push & email notifications
│   │   ├── database/     # Database configuration
│   │   ├── common/       # Shared utilities
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env              # Backend environment variables
│   ├── package.json
│   └── tsconfig.json
│
├── src/                  # React frontend application
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilities and API clients
│   └── types/           # TypeScript types
│
├── docs/                # Documentation
├── api/                 # Legacy Vercel serverless functions
├── .env.local          # Frontend environment variables
├── package.json
└── vite.config.ts
```

---

## Common Development Tasks

### Create a New Database Migration

```bash
cd backend
npm run migration:generate -- -n MigrationName
npm run migration:run
```

### Run Tests

#### Frontend Tests
```bash
npm run test
npm run test:coverage
```

#### Backend Tests
```bash
cd backend
npm run test
npm run test:e2e
npm run test:cov
```

### Lint and Format Code

```bash
# Frontend
npm run lint

# Backend
cd backend
npm run lint
npm run format
```

### Build for Production

```bash
# Frontend
npm run build

# Backend
cd backend
npm run build
```

---

## Database Management

### View Database Tables

```bash
psql -h localhost -U poscal_user -d poscal_db

-- List all tables
\dt

-- Describe a table
\d trading_journal

-- Query data
SELECT * FROM profiles LIMIT 10;
```

### Reset Database

```bash
cd backend
npm run migration:revert  # Revert last migration
npm run migration:run     # Run migrations again
```

### Seed Test Data

```bash
cd backend
npm run seed
```

---

## Troubleshooting

### Port Already in Use

If port 3001 or 5173 is already in use:

```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Issues

1. Check PostgreSQL is running:
```bash
# macOS
brew services list

# Linux
sudo systemctl status postgresql
```

2. Verify connection string in `.env`
3. Check PostgreSQL logs:
```bash
tail -f /usr/local/var/log/postgresql@15.log  # macOS
sudo tail -f /var/log/postgresql/postgresql-15-main.log  # Linux
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# For backend
cd backend
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Errors

```bash
# Frontend
npm run build

# Backend
cd backend
npm run build
```

---

## Environment-Specific Configuration

### Development
- Hot reload enabled
- Detailed error messages
- SQL query logging enabled
- CORS enabled for localhost

### Staging
- Similar to production
- Test payment credentials
- Separate database

### Production
- Optimized builds
- Error tracking (Sentry)
- Production database
- SSL/HTTPS required

---

## API Testing

### Using cURL

```bash
# Health check
curl http://localhost:3001/health

# Get prices (requires auth token)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/prices?symbols=EURUSD,GBPUSD
```

### Using Postman

1. Import the Swagger/OpenAPI spec from http://localhost:3001/api/docs-json
2. Set up environment variables for base URL and auth token
3. Test all endpoints

### Using Swagger UI

Navigate to http://localhost:3001/api/docs for interactive API documentation

---

## Git Workflow

### Branch Naming Convention

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Urgent production fixes
- `refactor/` - Code refactoring

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

Example:
```
feat(trading): add support for crypto symbols

- Added crypto symbol validation
- Updated price fetching logic
- Added tests for crypto trading

Closes #123
```

---

## Docker Development (Alternative)

### Using Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Stop all services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
```

---

## Getting Help

- **Documentation**: Check the `/docs` folder
- **API Docs**: http://localhost:3001/api/docs
- **Issues**: Create a GitHub issue
- **Team Chat**: [Your team communication channel]

---

## Next Steps

1. ✅ Set up development environment
2. Read [API_ENDPOINTS.md](./API_ENDPOINTS.md) for API documentation
3. Read [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for database structure
4. Start implementing features!
5. Check [TODO.md](../TODO.md) for migration progress
