#!/usr/bin/env bash
# Local dev helper. Usage: infra/dev.sh up|down|reset|seed|check|setup
set -euo pipefail

cd "$(dirname "$0")"
compose() { docker compose -f docker-compose.yml "$@"; }

case "${1:-}" in
  up)
    compose up -d --wait
    ;;
  down)
    compose down
    ;;
  reset)
    # Deletes all local data (databases and queue).
    compose down -v
    ;;
  seed)
    shopt -s nullglob
    files=(seed/*.sql)
    if [ ${#files[@]} -eq 0 ]; then
      echo "No seed files in infra/seed yet."
    fi
    for f in "${files[@]}"; do
      echo "Seeding from $f"
      compose exec -T postgres psql -v ON_ERROR_STOP=1 -U parts -d parts_builder < "$f"
    done
    ;;
  check)
    compose exec -T postgres pg_isready -U parts -d parts_builder
    compose exec -T redis redis-cli ping
    ;;
  setup)
    "$0" up
    "$0" seed
    "$0" check
    echo "Local services are ready. Copy .env.example to .env.local if you have not."
    ;;
  *)
    echo "Usage: $0 up|down|reset|seed|check|setup" >&2
    exit 1
    ;;
esac
