#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
FILE="${1:?Användning: ./restore.sh backups/fil.sql.gz}"
gunzip -c "$FILE" | docker compose exec -T db psql -U todo -d todos
echo "Återställd från $FILE"
