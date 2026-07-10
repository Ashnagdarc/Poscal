#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${EXPORT_DIR:-$ROOT_DIR/exports/convex}"
DATABASE_URL="${POSTGRES_EXPORT_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "Set POSTGRES_EXPORT_DATABASE_URL or DATABASE_URL before running this script." >&2
  exit 1
fi

mkdir -p "$EXPORT_DIR"

export_table() {
  local source_table="$1"
  local output_file="$2"

  echo "[export] $source_table -> $output_file"
  docker run --rm postgres:16-alpine \
    psql "$DATABASE_URL" \
    -v ON_ERROR_STOP=1 \
    -Atc "COPY (SELECT row_to_json(t)::text FROM (SELECT * FROM ${source_table}) t) TO STDOUT" \
    > "$EXPORT_DIR/$output_file"
}

export_table "users" "users.raw.jsonl"
export_table "profiles" "profiles.raw.jsonl"
export_table "user_roles" "user_roles.raw.jsonl"
export_table "trading_journal" "trading_journal.raw.jsonl"
export_table "price_cache" "price_cache.raw.jsonl"
export_table "push_notification_queue" "push_notification_queue.raw.jsonl"
export_table "email_queue" "email_queue.raw.jsonl"

if docker run --rm postgres:16-alpine \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT to_regclass('public.trading_accounts') IS NOT NULL" \
  | grep -q "t"; then
  export_table "trading_accounts" "trading_accounts.raw.jsonl"
else
  echo "[export] trading_accounts table not found; skipping"
fi

echo "[export] complete: $EXPORT_DIR"
