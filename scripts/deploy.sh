#!/usr/bin/env sh
# Deploy the current git branch to this machine. The only deploy command.
#   sudo scripts/deploy.sh            # pull latest + rebuild + restart
#   sudo scripts/deploy.sh --no-pull  # rebuild what is checked out (rollbacks)
#
# Images are built one at a time: `next build` alone peaks at ~2 GB, and two
# concurrent builds plus the running stack would exhaust a 4 GB instance.

. "$(dirname "$0")/lib.sh"

if [ "${1:-}" != "--no-pull" ]; then
  log "Pulling latest code"
  git pull --ff-only
fi

log "Building backend image"
docker compose build migrate backend
log "Building frontend image"
docker compose build frontend

log "Starting stack (migrations run first, then the API, then the site)"
docker compose up -d --remove-orphans

log "Removing old images and stale build cache"
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null

site="$(envval SITE_ADDRESS)"
case "$site" in
  ""|:*) health_url="http://127.0.0.1/api/health" ;;
  *)     health_url="https://${site}/api/health" ;;
esac

log "Waiting for ${health_url}"
i=0
until curl -fsS -m 5 "$health_url" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    docker compose ps
    die "API did not become healthy within 150s. Check: docker compose logs backend migrate"
  fi
  sleep 5
done

log "Deployed. $(git log -1 --format='%h %s')"
docker compose ps --format 'table {{.Name}}\t{{.Status}}'
