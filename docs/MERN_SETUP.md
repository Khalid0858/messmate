# MERN setup and operations

Use Node 24, npm, and MongoDB configured as a replica set (Atlas is a replica set). Production never falls back to an in-memory database.

```sh
npm ci --prefix server
npm ci --prefix client
cp server/.env.example server/.env
npm run dev --prefix server
# another terminal
npm run dev --prefix client
```

The Vite app runs at http://localhost:5180 and proxies `/api` to Express on port 4000. Run the server from its package directory so dotenv reads `server/.env`. Set a real email provider before registration; a missing provider returns 503. Do not manually mark real accounts verified.

For a local fictional preview only, `npm run preview:local --prefix server` starts a real ephemeral MongoDB replica set, seeds `manager@example.test` / `Local-preview-123!`, and saves local test mail to `server/.local/inbox.json`. These are disposable test credentials, not a production backdoor. The script refuses production/Vercel execution. Preview data disappears when stopped.

## Vercel

The repository root contains `vercel.json`. The frontend is served from `client/dist`, and `/api/*` reaches the compiled Express function. One origin avoids cross-origin auth cookies. Do not deploy the old Vinext entry as the new frontend.

Configure encrypted production environment variables in Vercel:

| Variable                                                                  | Purpose                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                                                 | Exact canonical HTTPS origin, currently https://messmate-two.vercel.app                                          |
| `MONGODB_URI`                                                             | Dedicated database user restricted to this application's database                                                |
| `TRUST_PROXY`                                                             | `1` behind Vercel's trusted proxy                                                                                |
| `MAIL_FROM`, `RESEND_API_KEY`                                             | Verified sender/domain and real email API credential                                                             |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`                    | Alternative SMTP provider, not needed with Resend                                                                |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Private S3-compatible receipt bucket with least-privilege access                                                 |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`                  | Optional real SMS sender approved for destination countries                                                      |
| `CRON_SECRET`                                                             | Random server-only secret for an external scheduler to call `/api/jobs/notifications` using Bearer authorization |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob store; takes precedence over S3 configuration |
| `BACKUP_KEY` | Random 32-byte base64 key for encrypted daily backups; retain a separate secure recovery copy |

Never use `VITE_` for secrets. Restrict database network access to deployment infrastructure where possible; do not silently open an existing database to all IPs. Free hosting/database tiers have limits and are not a promise of unlimited free service. No paid plan is automatically created by this repository.

Vercel functions do not rely on background timers. A deposit decision dispatches one queued email for that mess inline; the protected notification endpoint and daily backup job also process eligible queued messages. A standalone Express process has a timer. Provider acceptance is not delivery confirmation. Ambiguous sends stay `unknown`; reconcile provider logs before any resend. The owner selected email/in-app notifications and deferred SMS. The SMS adapter remains available for a later explicitly configured rollout; missing-channel historical events retain their original SMS meaning.

## First manager setup

1. Verify email, sign in and create a mess. Set name/location.
2. Invite members using email-bound, expiring links. Share links yourself.
3. Set accounting rules before entering meals/expenses for the effective month.
4. Configure receiving wallet numbers/instructions and your own official QR.
5. Assign the monthly manager, publish daily menus/deadlines and assign bazar duties.
6. Members submit wallet references; manager matches provider records before approval. Cash is entered by the manager after receipt.
7. Resolve pending deposits, expenses, corrections and advances before finalizing a completed month. Download a private backup and statement.

## Health and recovery

`/api/health` checks process/version; `/api/ready` checks database connectivity. A healthy process alone does not mean email, SMS, receipts or financial flows are configured.

Use MongoDB `mongodump` to encrypted operator-controlled backup storage and versioned private object-storage backups. Test restoring to a separate database before cutover. The admin JSON export preserves one mess ledger but is **not** a complete auth/upload database backup. Never commit dumps.

The deployment now includes a daily encrypted backup job with 30-day retention. See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) for restore instructions, bounded archive limits and verification evidence. The Vercel private Blob store is on the existing Hobby plan. Receipt uploads are limited to 4 MB to fit the serverless request limit.

The owner has configured a Brevo Free account and verified Gmail sender for SMTP. It allows 300 emails per day. A free Gmail sender may have worse deliverability than an authenticated custom domain. Do not claim delivery solely from SMTP acceptance; check the provider log and recipient inbox. SMTP credentials expire after one year or 90 days of inactivity. Brevo currently shows zero SMS credits; the free email quota does not provide free production SMS.

Rollback application code with Vercel's previous deployment. Restore a database only through a deliberate maintenance window after backing up current writes; do not blindly roll financial data back. The legacy private Site remains available until a verified migration/cutover. Keep its original access restrictions.

## Limits

Each mess is an atomic MongoDB document, capped at 8 MB and 100 members. Queries return a bounded household aggregate, and tables paginate locally; this is not server-paginated unlimited accounting storage. Financial revision conflicts require refresh/retry and preserve the original request ID. Idempotency keys persist rather than expiring after a short window. Notifications and audit logs also consume the bound.

Amounts are integer paisa. Booking portions use integer half units. Confirmed bookings are billable; there is no separate consumption meter. Recurrences are materialized over a maximum 62-day range; explicit dates are preserved as exceptions. Stock tracks quantity only. It does not change meal costs. A cancelled service requires explicit booking corrections first.

Finalized months cannot be silently edited. Only the admin may reopen the latest dependent finalized month with a reason; the old version stays preserved. Later-month calculations are suspended until re-finalization. Historical imported snapshots remain read-only. Browser print supports Save as PDF; there is no independent server-generated PDF renderer. Bengali landing/navigation and key controls are implemented; some detailed operational form labels remain English.

## September usability release
See [upgrade guide](UPGRADE_2026_09.md) and [architecture](ARCHITECTURE.md). Add the existing production CRON_SECRET as the GitHub Actions secret MESSMATE_CRON_SECRET using a secure CLI/stdin or encrypted settings. Never commit it. SUPPORT_EMAIL may override the operator recipient; otherwise the address in MAIL_FROM is used. Run npm run test:browser --prefix client after installing Playwright Chromium. Tests start isolated local services and require no production secrets.
