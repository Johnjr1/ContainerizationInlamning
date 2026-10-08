#!/usr/bin/env bash
# Användning: ./copy-to-ec2.sh ~/Downloads/min-nyckel.pem ELASTIC-IP
set -euo pipefail
cd "$(dirname "$0")"
KEY="${1:?pem-fil saknas}"; HOST="${2:?IP saknas}"
chmod 400 "$KEY"
ssh -i "$KEY" ubuntu@"$HOST" "mkdir -p ~/todo"
scp -i "$KEY" docker-compose.yml .env backup.sh restore.sh ubuntu@"$HOST":~/todo/
ssh -i "$KEY" ubuntu@"$HOST" "chmod +x ~/todo/*.sh && sed -i 's/\r\$//' ~/todo/*.sh"
echo "Uppladdat. Logga in: ssh -i $KEY ubuntu@$HOST"
