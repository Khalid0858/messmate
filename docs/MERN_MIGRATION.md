# D1 → MongoDB migration

No production migration is implicit in deployment. Preserve the old private app, D1 backup, R2 private objects and source history first. Export each ledger through the authenticated old owner or a trusted D1 administrative export. The converter consumes the ledger JSON stored in D1, not a SQL dump. Export metadata/ownership evidence separately.

`server/src/migration.ts` maps members, doubled half-unit meals, expenses, verified deposits, uncredited pending/rejected wallet submissions, receiving accounts, menus, audit history and finalized snapshots. Linked approved wallet submissions do not create a second deposit. All original fields, payment history, receipt references and snapshots also remain in `legacy.source`. That archive is not included in ordinary member API responses.

The old app calculated months independently; the new app carries balances. Never invent an opening balance by summing unrelated historical snapshots. Obtain manager-reviewed integer-paisa opening balances for every member at a clean next-month cutover. Historical records become read-only, with the original accounting reports preserved. New-month rules apply only after cutover.

Create a protected mapping JSON outside the repository:

```json
{
  "legacyId": "the-original-d1-mess-id",
  "ownerMemberId": "original-owner-member-id",
  "ownerUserId": "verified-new-mongodb-user-id",
  "ownerProofVerified": true,
  "cutover": "2026-10",
  "openingBalances": { "original-owner-member-id": 0 }
}
```

Set `ownerProofVerified` only after checking the **old authenticated owner's identity and access**, plus the target account's verification. An email match alone is insufficient. Other users claim membership via a fresh admin-issued invitation bound to their verified email; no automatic access is granted by matching old email strings.

```sh
cd server
npm run migrate -- /protected/ledger.json /protected/mapping.json --dry-run
npm run migrate -- /protected/ledger.json /protected/mapping.json --apply
```

Dry-run does not connect to MongoDB. It compares source/target member, meal, expense, deposit and snapshot counts, verified-deposit totals and finalized due totals. It emits a source SHA256. An apply requires a verified target owner, writes an exclusive source backup, and imports under a unique `legacyId`. Retrying the same source is a no-op; importing a different source into that ID is rejected. Keep reports/backups private. Source histories larger than the aggregate limit require an archival design before cutover.

Receipt metadata/reference preservation is implemented; automatic R2-to-S3 object copying is not. Copy private objects through authenticated operator access, verify checksums/counts, create Upload metadata and update mapped references before enabling downloads. Never convert old private receipts to public links.

Rollback before cutover: retain the old app as the source of truth and discard only the explicitly identified unused test import after backup. After accepting new writes, stop writes, back up both systems and reconcile before changing systems. Do not overwrite live MongoDB records with a repeated migration.

The included fixture test proves linked-payment deduplication, fractional-unit conversion, snapshot/record preservation, opening balances and historical write rejection. On 28 September 2026 the authenticated Sites database viewer was used to inspect all rows in DB.households: one version-0 household, zero members/meals/expenses/deposits/history entries and zero closed snapshots. The response was complete and untruncated. There are no legacy financial records or receipt references to import. No empty household was linked by guessing its owner's email. The original private Site remains intact; if new records are added there, export and reconcile again before cutover.
