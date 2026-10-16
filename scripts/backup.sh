#!/usr/bin/env sh
# Nightly backup. Installed in cron by server-setup.sh; also fine to run by hand.
#   sudo scripts/backup.sh
#
#   1. pg_dump (custom format, already compressed) -> /var/backups/lms/
#   2. copy the dump to s3://$BACKUP_BUCKET/db/
#   3. sync the uploads volume to s3://$BACKUP_BUCKET/storage/
#   4. prune dumps older than 30 days (local and bucket)
#   5. refuse to report success if the root disk is over 85% full
#   6. ping HEARTBEAT_URL (UptimeRobot) only when everything above worked,
#      so a silently failing backup shows up as a missed heartbeat.
#
# The AWS CLI needs no stored keys when the instance is attached to the
# bucket under Lightsail -> bucket -> "Resource access".

. "$(dirname "$0")/lib.sh"

RETENTION_DAYS=30
DISK_LIMIT_PCT=85
BACKUP_DIR=/var/backups/lms

bucket="$(envval BACKUP_BUCKET)"
pg_user="$(envval POSTGRES_USER)"
pg_db="$(envval POSTGRES_DB)"
AWS_DEFAULT_REGION="$(envval AWS_DEFAULT_REGION)"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"
heartbeat="$(envval HEARTBEAT_URL)"

[ -n "$bucket" ] || die "BACKUP_BUCKET is not set in .env"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M)"
dump="$BACKUP_DIR/db-${stamp}.dump"

log "Dumping database ${pg_db}"
docker compose exec -T postgres pg_dump -Fc -U "$pg_user" "$pg_db" > "$dump"
[ -s "$dump" ] || die "Dump is empty"

log "Uploading dump to s3://${bucket}/db/"
aws s3 cp --only-show-errors "$dump" "s3://${bucket}/db/$(basename "$dump")"

# The uploads volume is found by its compose label, so this works whatever
# the project directory is called.
volume="$(docker volume ls -q --filter label=com.docker.compose.volume=backend_storage | head -n 1)"
[ -n "$volume" ] || die "backend_storage volume not found (is the stack running?)"
storage_path="$(docker volume inspect -f '{{ .Mountpoint }}' "$volume")"

log "Syncing uploads from ${storage_path} to s3://${bucket}/storage/"
aws s3 sync --only-show-errors --exclude 'tmp/*' "$storage_path" "s3://${bucket}/storage/"

log "Pruning dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'db-*.dump' -mtime +"$RETENTION_DAYS" -delete
cutoff="$(date -u -d "-${RETENTION_DAYS} days" +%Y%m%d)"
aws s3 ls "s3://${bucket}/db/" | awk '{print $4}' | while read -r key; do
  day="$(printf '%s' "$key" | sed -nE 's/^db-([0-9]{8})-.*/\1/p')"
  if [ -n "$day" ] && [ "$day" -lt "$cutoff" ]; then
    aws s3 rm --only-show-errors "s3://${bucket}/db/${key}"
  fi
done

used_pct="$(df --output=pcent / | tail -n 1 | tr -dc '0-9')"
if [ "$used_pct" -ge "$DISK_LIMIT_PCT" ]; then
  die "Root disk is ${used_pct}% full (limit ${DISK_LIMIT_PCT}%). See OPERATIONS.md -> Disk filling up."
fi

if [ -n "$heartbeat" ]; then
  curl -fsS -m 10 "$heartbeat" >/dev/null || log "WARNING: heartbeat ping failed"
fi

log "Backup OK: $(basename "$dump") ($(du -h "$dump" | cut -f1)), disk ${used_pct}% used"
