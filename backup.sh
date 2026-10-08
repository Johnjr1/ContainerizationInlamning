#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
FILE="backups/todos_$(date +%F_%H%M).sql.gz"
docker compose exec -T db pg_dump -U todo -d todos --clean --if-exists | gzip > "$FILE"
find backups -name 'todos_*.sql.gz' -mtime +7 -delete   # behåll 7 dagar
echo "Backup klar: $FILE"
