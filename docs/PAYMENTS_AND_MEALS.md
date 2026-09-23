# Wallet contributions and meal planning

## Payment setup

The household manager opens **Payments → Configure** for bKash, Nagad or Rocket, enters the receiving number, account holder and precise instructions (Send Money or merchant Payment as appropriate), then enables the method. No sample receiving number is configured in production. Members send money in the provider's app, then submit the transaction ID, amount, date and sender number in MessMate. Only the final four sender digits are retained. No PIN, OTP, wallet password or merchant secret is collected.

The manager must verify the transaction ID, actual amount and recipient in their receiving account. **Approve** adds exactly one linked deposit; **Reject** requires a reason and does not credit money. Pending submissions do not affect reconciliation. History shows member, provider, transaction ID, payment date, submission/review timestamps in Bangladesh time, decision, reviewer and reason. Members see their own submissions in the payment screen; the household ledger and audit log remain shared among authorized household members, not a private banking portal.

Duplicate references are rejected within the same provider and household, including rejected/voided records. IDs are case-normalized. Concurrent approvals use the household's atomic compare-and-swap version check: at most one succeeds. A rejected request must not be blindly retried; refresh first. Approved deposits cannot be edited. A manager can void an incorrect verified deposit with a reason; the payment is also marked voided, and the original evidence remains. Closed months prohibit these changes. Ten pending submissions per member limit unreviewed requests. Pending payments block month finalization.

This release is **manual verification**, as requested. It does not initiate payments, automatically validate provider receipts, process refunds or claim integration with provider APIs. Sending money and any provider fees happen outside MessMate. QR checkout and merchant webhooks are not implemented. A future gateway needs merchant onboarding, secure server secrets, signed callbacks and provider-side amount/currency verification before it can replace this flow.

## Meal planning

**Meal planner** shows a seven-day date selector, each meal's menu, availability, booking cutoff and headcount. Managers publish breakfast, lunch and dinner independently for each date. All deadlines use Asia/Dhaka. Existing bookings must be corrected before a service can be cancelled, preventing silent loss of meal counts.

Members choose **Turn meals on / off**, a start/end date (up to 31 days), and counts for each meal. Zero means off, one means on; extra counts include guests. These are confirmed bookings that count toward monthly food allocation. They replace existing counts in the range. An unavailable service, passed cutoff, pre-membership date or finalized month rejects the entire range without partial writes. Members can only change their own counts. Managers can correct historical entries in Meal tracker while the month remains open.

Published menus use per-meal cutoffs. Dates without a published menu preserve the legacy 10:00 AM deadline and allow booking before the menu is announced. Unchanged slots can remain unchanged after their deadline when a different, still-open slot is edited. There is no background recurring schedule; each range is saved as explicit dated records.

## Release and operations

- Existing D1 JSON ledgers load with empty optional payment/menu collections; no destructive migration or data reseeding is needed.
- The API keeps server-side household/role authorization, same-origin checks, integer-paisa amounts, bounded input and atomic ledger/history updates.
- Keep production access owner-private unless the owner explicitly changes sharing. Invited member emails alone do not grant site access.
- Run typecheck, domain tests, production build and isolated Worker integration tests before publication. Tests cover concurrent approval and permission rejection.
- Save the exact Git commit with the build archive, deploy that version and verify terminal deployment success. Publish the same commit to GitHub.
- For recovery, deploy the last compatible saved version; export settlement CSV for operational reconciliation. CSV is not a full database backup. Configure infrastructure backups and monitoring before operating at a larger scale.
- This remains a small-household product with a 100-member and 1.5-million-character ledger limit. It is not a certified banking system or a claim of an independent security audit/SLA.
