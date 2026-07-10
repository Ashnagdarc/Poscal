#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/env}"
GPG_PASSPHRASE="${GPG_PASSPHRASE:-}"

if [[ -z "$GPG_PASSPHRASE" ]]; then
  echo "GPG_PASSPHRASE is required for env backups" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

copy_if_exists() {
  local source="$1"
  local target="$2"
  if [[ -f "$ROOT_DIR/$source" ]]; then
    mkdir -p "$(dirname "$WORK_DIR/$target")"
    cp "$ROOT_DIR/$source" "$WORK_DIR/$target"
  fi
}

copy_if_exists ".env" ".env"
copy_if_exists ".env.local" ".env.local"
copy_if_exists ".env.production" ".env.production"
copy_if_exists "backend/.env" "backend/.env"
copy_if_exists "push-sender/.env" "push-sender/.env"

if [[ -z "$(find "$WORK_DIR" -type f -print -quit)" ]]; then
  echo "No env files found to back up" >&2
  exit 1
fi

ARCHIVE="$BACKUP_DIR/poscal-env-$TIMESTAMP.tar.gz"
ENCRYPTED="$ARCHIVE.gpg"

tar -C "$WORK_DIR" -czf "$ARCHIVE" .

gpg --batch --yes --pinentry-mode loopback \
  --passphrase "$GPG_PASSPHRASE" \
  --symmetric --cipher-algo AES256 \
  --output "$ENCRYPTED" "$ARCHIVE"

rm -f "$ARCHIVE"

echo "[env-backup] wrote $ENCRYPTED"
