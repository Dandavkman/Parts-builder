# Database backups (B2.11d)

A GitHub Actions workflow (`.github/workflows/backup.yml`) runs `scripts/backup-db.sh` every day at 05:17 UTC. It dumps Postgres with `pg_dump`, compresses it and uploads it to a private R2 bucket as `backups/<timestamp>.sql.gz`. **Until the secrets below exist, it skips quietly.**

## Turn it on

1. Create a private R2 bucket for backups (not the scan bucket). Add a lifecycle rule to delete objects older than 30 days.
2. In GitHub, Settings, Secrets and variables, Actions, add:
   - `BACKUP_DATABASE_URL`: the Neon connection string (a read-only role is better).
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BACKUP_BUCKET`: an R2 token that can write to that bucket only.
3. Run the workflow once by hand (Actions, Daily database backup, Run workflow) and check the object appears.

Backups contain customer data. Never commit one, and keep the bucket private.

## Restore

```
aws s3 cp s3://<bucket>/backups/<file>.sql.gz . --endpoint-url https://<account>.r2.cloudflarestorage.com
gunzip -c <file>.sql.gz | psql "$NEW_DATABASE_URL"
```

Restore into a new, empty Neon branch or project first, check it, then point `DATABASE_URL` at it. Practice this once before you need it.

## Notes

Neon also keeps its own point-in-time history (length depends on the plan). This script is the independent copy that survives losing the Neon account.
