#!/usr/bin/env sh
# Shared helpers for the ops scripts. Source with:  . "$(dirname "$0")/lib.sh"
# POSIX sh only (Ubuntu's /bin/sh is dash).

set -eu

# Repository root = parent of the scripts directory.
LMS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$LMS_ROOT"

if [ ! -f .env ]; then
  echo "ERROR: $LMS_ROOT/.env not found. Copy .env.example and fill it in." >&2
  exit 1
fi

# Read one value from .env without sourcing it (values may contain shell
# metacharacters such as `*` or `@`). Strips surrounding quotes.
envval() {
  grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}
