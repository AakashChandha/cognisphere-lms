#!/usr/bin/env sh
# Restore the database from a pg_dump custom-format file.
#   sudo scripts/restore-db.sh /var/backups/lms/db-20261016-0230.dump
#   sudo scripts/restore-db.sh s3://my-bucket/db/db-20261016-0230.dump
#
# Stops the app, drops and recreates the database, restores, starts the app.
# Uploaded files are not touched (restore those with `aws s3 sync` from
# s3://$BACKUP_BUCKET/storage/ into the volume, see OPERATIONS.md).

. "$(dirname "$0")/lib.sh"

src="${1:-}"
[ -n "$src" ] || die "Usage: $0 <dump-file | s3://bucket/db/file.dump>"

pg_user="$(envval POSTGRES_USER)"
pg_db="$(envval POSTGRES_DB)"
AWS_DEFAULT_REGION="$(envval AWS_DEFAULT_REGION)"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-south-1}"

case "$src" in
  s3://*)
    mkdir -p /var/backups/lms
    local_file="/var/backups/lms/$(basename "$src")"
    log "Downloading $src"
    aws s3 cp --only-show-errors "$src" "$local_file"
    src="$local_file"
    ;;
esac
[ -s "$src" ] || die "Dump file not found or empty: $src"

printf 'This will REPLACE database "%s" with %s. Type yes to continue: ' "$pg_db" "$src"
read -r answer
[ "$answer" = "yes" ] || die "Aborted"

log "Stopping the application"
docker compose stop backend frontend

log "Recreating database ${pg_db}"
docker compose exec -T postgres psql -U "$pg_user" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${pg_db}\" WITH (FORCE);" \
  -c "CREATE DATABASE \"${pg_db}\" OWNER \"${pg_user}\";"

log "Restoring from $(basename "$src")"
docker compose exec -T postgres pg_restore -U "$pg_user" -d "$pg_db" --no-owner --no-privileges --exit-on-error < "$src"

log "Starting the application"
docker compose up -d

log "Restore complete"
