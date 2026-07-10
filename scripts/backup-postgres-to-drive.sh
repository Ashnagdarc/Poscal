#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASE_URL="${POSTGRES_BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
GPG_PASSPHRASE="${GPG_PASSPHRASE:-}"

mkdir -p "$BACKUP_DIR"

RAW_FILE="$BACKUP_DIR/poscal-postgres-$TIMESTAMP.sql"
GZ_FILE="$RAW_FILE.gz"
FINAL_FILE="$GZ_FILE"

echo "[backup] creating postgres backup at $RAW_FILE"

if [[ -n "$DATABASE_URL" ]]; then
  docker run --rm postgres:16-alpine pg_dump --no-owner --no-acl "$DATABASE_URL" > "$RAW_FILE"
else
  POSTGRES_USER="${POSTGRES_USER:-poscal_user}"
  POSTGRES_DB="${POSTGRES_DB:-poscal_db}"
  (
    cd "$ROOT_DIR"
    docker compose exec -T postgres pg_dump --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"
  ) > "$RAW_FILE"
fi

gzip -f "$RAW_FILE"

if [[ -n "$GPG_PASSPHRASE" ]]; then
  echo "[backup] encrypting backup"
  gpg --batch --yes --pinentry-mode loopback \
    --passphrase "$GPG_PASSPHRASE" \
    --symmetric --cipher-algo AES256 \
    --output "$GZ_FILE.gpg" "$GZ_FILE"
  rm -f "$GZ_FILE"
  FINAL_FILE="$GZ_FILE.gpg"
else
  echo "[backup] GPG_PASSPHRASE not set; backup is compressed but not encrypted"
fi

if [[ -n "$RCLONE_REMOTE" ]]; then
  echo "[backup] uploading to $RCLONE_REMOTE"
  rclone copy "$FINAL_FILE" "$RCLONE_REMOTE"
fi

find "$BACKUP_DIR" -type f -name 'poscal-postgres-*' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] done: $FINAL_FILE"
