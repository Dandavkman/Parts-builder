#!/usr/bin/env bash
# Daily database backup (B2.11d). Dumps Postgres, compresses, and uploads to R2 (S3 API).
# Does nothing, successfully, unless every variable below is set. Set DRY_RUN=1 to dump locally only.
#
#   BACKUP_DATABASE_URL   connection string of the database to back up (use a read-only role if you can)
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET
set -euo pipefail

if [[ -z "${BACKUP_DATABASE_URL:-}" ]]; then
  echo "BACKUP_DATABASE_URL is not set; skipping backup."
  exit 0
fi

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
file="${TMPDIR:-/tmp}/parts-builder-${stamp}.sql.gz"
trap 'rm -f "$file"' EXIT

pg_dump --no-owner --no-privileges "$BACKUP_DATABASE_URL" | gzip -9 > "$file"
size="$(wc -c < "$file")"
if [[ "$size" -lt 200 ]]; then
  echo "Dump is only ${size} bytes; refusing to treat it as a backup." >&2
  exit 1
fi
echo "Dumped ${size} bytes."

if [[ "${DRY_RUN:-}" == "1" ]]; then
  echo "DRY_RUN=1: not uploading. Dump would be named backups/${stamp}.sql.gz"
  exit 0
fi

for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BACKUP_BUCKET; do
  if [[ -z "${!v:-}" ]]; then
    echo "${v} is not set; the dump was not uploaded." >&2
    exit 1
  fi
done

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto \
  aws s3 cp "$file" "s3://${R2_BACKUP_BUCKET}/backups/${stamp}.sql.gz" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
echo "Uploaded backups/${stamp}.sql.gz"
