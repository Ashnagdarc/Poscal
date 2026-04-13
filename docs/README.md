# Poscal

Poscal is a trading journal and signals platform built around a React frontend, a NestJS backend, PostgreSQL, and background workers for prices and push notifications.

## Current Architecture

- `src/`: React + Vite frontend
- `backend/`: NestJS API with TypeORM and PostgreSQL
- `push-sender/`: background workers for push delivery and Finnhub price ingestion
- `api/`: legacy Vercel serverless handlers kept for compatibility
- `docs/`: setup, deployment, and feature documentation

## Core Features

- Trading journal with analytics and history
- Trading signals with live forex prices
- Premium subscriptions and Paystack payments
- Web push notifications for signal updates
- Admin tooling for signals, users, and platform controls
- PWA support for installable mobile and desktop usage

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query

### Backend

- NestJS
- TypeORM
- PostgreSQL
- JWT authentication
- Socket.IO for realtime prices

### Services

- Finnhub for market data
- Paystack for payments
- Web Push with VAPID keys
- Vercel for frontend hosting and compatibility API routes

## Local Development

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL 15+

### 1. Install Dependencies

From the project root:

```bash
npm install
cd backend && npm install && cd ..
cd push-sender && npm install && cd ..
```

### 2. Configure Environment Files

Frontend:

```bash
cp .env.production .env.local
```

Then update `.env.local` with your local values, especially:

```env
VITE_API_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

Backend:

```bash
cp backend/.env.example backend/.env
```

Push sender:

```bash
cp push-sender/.env.example push-sender/.env
```

Vercel local serverless envs, if you use `vercel dev`:

```bash
cp .env.vercel.example .env.vercel
```

### 3. Start PostgreSQL

Make sure your PostgreSQL instance is running and that the database in `backend/.env` exists.

### 4. Run Backend Migrations

```bash
cd backend
npm run migration:run
cd ..
```

### 5. Start the App

Backend:

```bash
cd backend
npm run start:dev
```

Frontend:

```bash
npm run dev
```

Optional push workers:

```bash
cd push-sender
npm run dev:notification
npm run dev:prices
```

### Local URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`
- Swagger docs: `http://localhost:3001/api/docs`

## Deployment Overview

- Frontend builds to `dist/` and can be deployed to Vercel
- NestJS backend runs separately on your server or VPS
- `push-sender/` workers run independently, typically under PM2
- `api/` contains legacy Vercel handlers that proxy or support a few server-side flows

## Project Structure

```text
Poscal/
├── api/                # Legacy Vercel serverless handlers
├── backend/            # NestJS backend
├── docs/               # Project documentation
├── push-sender/        # Notification + price workers
├── public/             # Static assets
├── src/                # React frontend
├── .env.production     # Frontend production env template
├── .env.vercel.example # Server-side env template for Vercel functions
├── package.json        # Frontend/root scripts
└── vercel.json         # Vercel configuration
```

## Useful Docs

- [Development Setup](./DEVELOPMENT_SETUP.md)
- [Backend Switch](./BACKEND_SWITCH.md)
- [API Endpoints](./API_ENDPOINTS.md)
- [Push Notification Deployment](./PUSH_NOTIFICATION_DEPLOYMENT.md)
- [Ask Price Implementation](./ASK_PRICE_IMPLEMENTATION.md)

## Support

- GitHub Issues: [Create an issue](https://github.com/Ashnagdarc/Poscal/issues)
- Email: `admin@poscal.app`
