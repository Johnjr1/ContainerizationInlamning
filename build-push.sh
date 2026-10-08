#!/usr/bin/env bash
# Bygger (docker build) och pushar (docker push) alla tre images till Docker Hub.
# Standard: linux/amd64 (vanlig EC2 t2/t3). För Graviton (t4g): PLATFORM=linux/arm64 ./build-push.sh
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a
PLATFORM="${PLATFORM:-linux/amd64}"
TAG="${TAG:-latest}"
for s in api frontend lb; do
  IMAGE="$DOCKERHUB_USER/todo-$s:$TAG"
  echo ">> docker build $IMAGE ($PLATFORM)"
  docker build --platform "$PLATFORM" -t "$IMAGE" "./$s"
  echo ">> docker push $IMAGE"
  docker push "$IMAGE"
done
echo "Klart. Kontrollera plattform: docker image inspect --format '{{.Architecture}}' $DOCKERHUB_USER/todo-api:$TAG"
