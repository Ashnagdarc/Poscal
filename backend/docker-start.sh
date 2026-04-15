#!/bin/sh
set -eu

echo "Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."

node <<'EOF'
const net = require('net');

const host = process.env.DB_HOST || 'postgres';
const port = Number(process.env.DB_PORT || '5432');
const maxAttempts = Number(process.env.DB_WAIT_MAX_ATTEMPTS || '60');
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || '2000');

function wait(attempt = 1) {
  const socket = net.createConnection({ host, port });

  socket.once('connect', () => {
    socket.end();
    process.exit(0);
  });

  socket.once('error', () => {
    socket.destroy();
    if (attempt >= maxAttempts) {
      console.error(`PostgreSQL did not become reachable after ${attempt} attempts.`);
      process.exit(1);
    }
    setTimeout(() => wait(attempt + 1), delayMs);
  });
}

wait();
EOF

if [ "${DB_AUTO_BOOTSTRAP:-false}" = "true" ]; then
  echo "Checking whether the database needs first-boot schema bootstrap..."

  NEEDS_BOOTSTRAP="$(
    node <<'EOF'
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'poscal_user',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'poscal_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'users'
    ) AS exists
  `);
  await client.end();
  process.stdout.write(result.rows[0]?.exists ? 'false' : 'true');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
EOF
  )"

  if [ "$NEEDS_BOOTSTRAP" = "true" ]; then
    echo "Fresh database detected. Bootstrapping schema from entities once..."
    npm run schema:sync:dist
  fi
fi

echo "Running database migrations..."
npm run migration:run:dist

echo "Starting Nest backend..."
exec node dist/main.js
