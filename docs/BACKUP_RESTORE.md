# Encrypted backup and recovery

The daily Vercel job `/api/jobs/backup` runs at 21:00 UTC (03:00 Bangladesh time; Hobby scheduling may run later within the hour). It requires `Authorization: Bearer <CRON_SECRET>`. Backups are AES-256-GCM encrypted, gzip compressed and stored in the **private** Vercel Blob store under `backups/messmate-`. Successful jobs retain the last 30 days; cleanup only selects that prefix and `.mmbak` extension. Receipts are never selected by retention cleanup.

`BACKUP_KEY` is a random 32-byte base64 secret. Keep a separately secured copy; losing it makes old archives unrecoverable. Do not rotate it without retaining the old key. Neither key nor archives belong in Git. Storage uses the Hobby allowance; exceeding the free quota can make storage unavailable. Check usage and backup-job logs regularly.

The snapshot reads users (including password hashes), mess ledgers and Upload metadata in one MongoDB snapshot transaction. It then copies each immutable receipt, preserving bytes, content type and SHA256. Financial snapshots, audit trails and idempotency records are inside the mess documents. Sessions, verification/reset tickets and rate counters are intentionally excluded: users sign in again after restore.

## Manual capture

Set MONGODB_URI, BACKUP_KEY and the private storage credentials through a secure environment. From `server/`:

```sh
node --experimental-transform-types src/backup-cli.ts backup /private/backup.mmbak
```

The command refuses to overwrite an existing archive. The bounded implementation supports up to 64 MB per collection and 48 MB of total receipt bytes. Larger deployments must move to streaming `mongodump` and object replication before reaching those limits; an oversized backup fails instead of silently omitting files.

## Restore

Provision a separate empty MongoDB replica-set database and separate private object store. Set RESTORE_MONGODB_URI, BACKUP_KEY, destination object-store variables and RESTORE_OBJECT_STORE_CONFIRMED=1. Do not use production credentials for the target.

```sh
node --experimental-transform-types src/backup-cli.ts restore /private/backup.mmbak
```

The command checks authenticated encryption, collection counts/hashes and receipt hashes; refuses populated targets; restores BSON types and unique indexes; then compares every restored collection against the source snapshot. Do not cut over until receipt downloads, sign-in and statements have been checked. A partial failed restore stays isolated for investigation; this tool does not delete targets automatically.

## Verification on 28 September 2026

- Production capture: users=0, messes=0, uploads=0. Encrypted local archive saved outside the repository; isolated restore reconciled without production writes.
- Representative non-empty replica-set test: user/date BSON values, finalized totals, deposit records, unique index and receipt bytes restored exactly. Occupied targets and modified ciphertext were rejected.
- Private Blob smoke test: write/read checksum matched; direct unauthenticated URL returned 403. Only the disposable verification object was deleted after the test.

The empty production rehearsal proves infrastructure access, not historical financial recovery. The non-empty fixture test provides the record/receipt preservation evidence. Daily-job execution must also be verified after deployment.
