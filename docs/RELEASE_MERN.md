# Usability release — 29 September 2026

This update follows the original MERN release below. See [upgrade notes](UPGRADE_2026_09.md) for features, manager setup, operational limits and rollback.

Local verification: 12 server/domain/integration/migration/backup tests passed; four isolated Playwright browser tests passed; server/client production builds and type checks passed. Browser checks cover account-aware logo navigation, reload/back/filter state, failed network/report handling, role restrictions, mobile layouts, keyboard dialogs and Bengali screens. These tests use fictional local records. Consult the commit's GitHub Actions results and the live health commit before treating it as deployed.

The notification schedule is now independent of the daily encrypted backup, with an authorized GitHub Actions secret. Support uses the existing real SMTP service. Self-hosted Inter and Noto Sans Bengali improve font rendering; no new paid service or SMS was enabled.

---

# MessMate release verification — 28 September 2026

## Deployed services

- Frontend: https://messmate-two.vercel.app
- Express health/version: https://messmate-two.vercel.app/api/health
- MongoDB readiness: https://messmate-two.vercel.app/api/ready
- Source: https://github.com/Khalid0858/messmate — made public at the owner's explicit request after an all-history redacted Gitleaks scan reported no leaks. The legacy Site and database remain private.

The React/Vite frontend and compiled Express/Mongoose backend run on Vercel with a dedicated Atlas Free cluster. A database-scoped readWrite user is stored in production secrets. The owner approved 0.0.0.0/0 access only for this project to support dynamic Vercel egress. TLS and password authentication remain required.

Brevo Free SMTP is configured (300 emails/day). Production verification and password-reset messages were marked Delivered and Opened in Brevo; the owner confirmed successful verification. Brevo rewrites the free Gmail sender to authenticated brevosend.com infrastructure. A custom domain is preferable for branding/deliverability. Reset-token consumption and session revocation are integration-tested; the agent did not change the owner's password.

The owner chose **free email and in-app notifications now, SMS later**. New deposit decisions atomically create an email outbox event. Concurrent dispatch claims once; provider acceptance is recorded and ambiguous failures remain unknown without blind retries. Existing SMS events keep their channel. No SMS credits were purchased and live SMS is not claimed.

Private receipts use Vercel Blob. Direct unauthenticated object access returned 403; authenticated write/read checksums matched. Express download requires mess membership and private/no-store caching. Supported signatures: JPG, PNG, WebP and PDF; maximum 4 MB.

## Product updates

Manual wallet deposits/cash, approval/reversal, meal/menu booking, date ranges and recurring exceptions, correction requests, bazar duties/advances, personal purchases, stock, notices, integer-paisa settlement, immutable snapshots and versioned reopening.

Public navigation retains Home, Features, How it works, FAQ, Contact and login/signup. All workspace sections remain in desktop/mobile navigation. Both footers credit **Khalid Hasan, All rights reserved**. Bengali labels cover common forms, statuses and tables. Meal weights, weekdays, category splits, itemized purchases and fixed shares use structured controls instead of JSON editors. The workspace loads separately from public pages.

## Verification

- 12 automated Node/MongoDB replica-set tests with multiple assertions: auth/reset/invites, cross-mess isolation, roles/CSRF, simultaneous approval/retry, single email dispatch, ambiguous-send handling, receipt isolation/signatures, deadlines/ranges/recurrence, paisa/occupancy/allocation, advance/purchase/reimbursement, finalization/carry/reopening, migration and encrypted backup restore/tamper rejection.
- Server/client type checks, production builds, dependency audits and GitHub Actions. Compare the exact workflow commit to health.commit before declaring a specific release verified.
- Public health/readiness 200; private APIs 401 when logged out. Backup job 401 without its secret and 200 with authorization. Private cloud archive download, authenticated decryption and checksums passed.
- Browser: live landing/signup/footer and email verification; local future-rule and itemized expense saves; no document overflow at 390px; mobile menu selection closes the drawer. Full assistive-technology certification has not been performed.

## Migration and recovery

Authenticated D1 inspection returned one empty version-0 household: zero members, meals, expenses, deposits, history and closed snapshots. There are no financial records or receipt references to import. No identity was linked by guessing an email. Reinspect if records are later added to the old Site.

Daily encrypted private backups run at 21:00 UTC (03:00 Dhaka, subject to Hobby scheduling jitter) with 30-day retention. Production capture and isolated restore were repeated after signup: **2 users, 1 mess, 0 uploads**, fully reconciled without production writes. A representative non-empty test restores financial snapshots, BSON dates, unique indexes and receipt bytes. See [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## Operating limits

- Free Vercel/Atlas/Brevo quotas apply; no paid plans were purchased.
- Preserve a separate secure BACKUP_KEY copy. Archives cannot be recovered without it. Larger datasets require streaming backup before the documented bounded archive limits.
- Mess documents are capped at 8 MB/100 members; tables paginate the fetched aggregate.
- Provider acceptance is not delivery confirmation. Deposit-email callbacks are not automated; reconcile unknown sends with provider logs. SMS is deferred by owner choice.
- PDF uses browser Print/Save as PDF. Some technical errors and historical audit messages remain English.
- No penetration-test or unrestricted production-readiness certification is claimed.

See [purchase and personal profile update](PURCHASE_PROFILE_UPDATE.md) for the item total fix, mandatory bazar photos, duty completion rules, profile privacy and new settings.
