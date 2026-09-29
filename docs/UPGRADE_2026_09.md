# MessMate usability and reliability upgrade

## Scope and audit
The logo did not destroy the session: it navigated to a public page with an unconditional logged-out header. Home worked when tested from Contact and FAQ. This release makes authenticated workspace branding point to Overview, adds account-aware public navigation, explicit workspace routes and top-of-page Home behavior.

## Changes
- Typed API errors distinguish authentication, permission, conflict and outage cases. Error screens do not replace unknown balances with zero. Cached private queries are cleared on session expiry/account changes.
- URL routes and month/date/filters survive reload and history. A bounded 30-second workspace refresh pauses while a form is open; focus refresh and manual refresh are available. A 409 preserves form input and fetches the latest revision for a deliberate retry.
- Member labels include email, and admin/monthly-manager badges reflect their distinct roles. Invitation metadata excludes token hashes; only admins can replace/revoke invitation links, with audit records.
- Setup guidance, compact overview, member balance, weekly meal strip, configured deadline/serving status, filter-aware deposits CSV, cash/refund summaries, purchase detail, month-end checklist, member statement and stock thresholds.
- Mobile tables become labeled records. Dialog/drawer keyboard behavior, skip links, Bengali meal text and footer are retained. New module boundaries remove a circular entry-point import.
- Support form sends to the configured service operator via SMTP; recipient is not published. Public submissions are limited to two per IP/hour and 20 globally/day. No password, PIN, OTP or financial documents should be submitted. Provider acceptance is reported accurately; support replies are manual.
- Favicon/social preview, canonical metadata, robots/sitemap, 404 and private-route noindex headers.

## Notification operations
Financial decisions commit before external delivery. SMTP failure does not undo or misreport the ledger mutation. Dispatch atomically claims each event and processes a bounded batch within the function budget. Claims older than ten minutes are marked unknown; ambiguous sends are never blindly repeated. Admins may record provider-log reconciliation notes without rewriting the original status or resending.

The Vercel daily backup no longer dispatches email. GitHub Production operations runs a separate notification/health job twice an hour, using an Actions secret, plus workflow_dispatch. Scheduled runs may be delayed; this is not a real-time SLA. Public repositories can have inactive schedules disabled by GitHub. GitHub Actions failure notifications depend on the owner's notification preferences. No SMS is enabled; no credits or paid plan were purchased. Delivery/bounce callbacks are not configured; accepted is not delivered.

Monitoring reports database readiness, queue age, unresolved sends, latest private backup age and maximum ledger BSON size. Quota usage across all providers still needs their dashboards; known byte counts are not a quota API or a billing forecast.

## Data and rollback
No bulk financial migration or ledger repartitioning is required. This is a backward-compatible schema-v2 extension: optional stockThresholds, notification target/event, and reconciliation metadata. Existing absent fields get safe defaults. Financial snapshots and old audit descriptions are preserved. Receipt bytes remain private.

Ledger remains a bounded aggregate (8 MB / 100 members) with revision compare-and-swap, because replacing it without a reconciled migration would add risk. Alert threshold is 7 MB. Tables still page a fetched aggregate. Before that bound or a sustained contention/latency increase, migrate append-only records into indexed collections with transaction-based ledger updates and reconciled snapshots. Do not advertise unlimited scale.

Rollback: promote the previous known-good Vercel deployment and retain the database. Additive fields do not change settlement arithmetic. Pause Production operations if rolling back before its monitor endpoint existed. Do not delete new records or restore a backup over a populated production DB. Restore into an isolated empty destination and reconcile before any cutover.

## Manager first use
1. Open Settings, confirm mess identity and existing effective sharing rules.
2. Review Members; assign the monthly manager and share invitations privately.
3. Configure intended receiving wallets; unused wallets remain disabled.
4. Publish breakfast/lunch/dinner menus, deadlines and serving times.
5. Plan bazar duty; record opening stock only when applicable, without duplicating purchase costs.
6. Verify actual receipt of money before approving deposits.
7. Resolve pending records, advances and unallocated expenses before closing a completed month.
8. Keep a secure independent BACKUP_KEY copy and review operational failures.

## Verification
See the GitHub MERN checks workflow for the exact commit. Browser tests run against an isolated MongoDB replica set and a local email fixture, never production accounts. Financial domain/integration tests remain mandatory. No Lighthouse, screen-reader certification or penetration-test score is claimed.
