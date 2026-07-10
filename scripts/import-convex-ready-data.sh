#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMPORT_DIR="${IMPORT_DIR:-$ROOT_DIR/exports/convex-ready}"
DEPLOYMENT_FLAG="${CONVEX_IMPORT_DEPLOYMENT_FLAG:---deployment dev}"

if [[ ! -d "$IMPORT_DIR" ]]; then
  echo "Import directory not found: $IMPORT_DIR" >&2
  echo "Run scripts/export-postgres-for-convex.sh and scripts/transform-postgres-export-for-convex.mjs first." >&2
  exit 1
fi

import_table() {
  local table="$1"
  local file="$IMPORT_DIR/$table.jsonl"

  if [[ ! -s "$file" ]]; then
    echo "[import] $table skipped; file missing or empty"
    return
  fi

  echo "[import] $file -> $table"
  # shellcheck disable=SC2086
  npx convex import --table "$table" "$file" --format jsonLines --append $DEPLOYMENT_FLAG
}

import_table profiles
import_table tradingAccounts
import_table tradingJournal
import_table priceSnapshots
import_table notificationQueue

echo "[import] complete"
