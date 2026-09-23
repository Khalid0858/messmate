# Test report

Updated and tested locally on 23 September 2026 with Node.js 24.19, the locked project dependencies, an isolated Worker test runtime and ephemeral D1/R2 storage. Production records were not seeded or modified by these tests.

## Automated domain tests

| ID | Feature / input | Expected | Actual | Status |
|---|---|---|---|---|
| UT01 | Allocate totals 0–999 across unequal weights | Sum of shares equals original integer total | Exact totals retained | Pass |
| UT02 | Personal food purchase plus fund utility cost | Personal payment credited once, cash remains correct | Expected cash and two balances matched | Pass |
| UT03 | Pending food expense | Excluded from bill and blocks finalization | Excluded and blocked | Pass |
| UT04 | Correct same member/date meals twice | Single row, changed count, history retained | One row and both history entries | Pass |
| UT05 | Member changes another person's meals/deposit | Rejected | Rejected | Pass |
| UT06 | Member changes today's meals after 10 AM Dhaka | Rejected | Rejected | Pass |
| UT07 | Edit closed month / backdate membership | Rejected | Rejected | Pass |
| UT08 | Negative/zero/over-precise money and invalid date | Rejected | Rejected | Pass |
| UT09 | Food with no meals, then unresolved expense question | Finalization blocked until both resolved | Blocked, then finalized | Pass |
| UT10 | Correct deposit and void duplicate | Correct totals with retained evidence | Expected totals/history | Pass |
| UT11 | Move or void a closed deposit | Rejected | Rejected | Pass |
| UT12 | Member detail changes and duplicate email | Manager-only and unique email | Rules enforced | Pass |

## Integration suite

Six additional domain tests cover pending/approved payment accounting, duplicate references, manager-only approval, immutable linked deposits and voiding, pending-payment month locks, recipient snapshots, service availability, Bangladesh per-slot cutoffs, and atomic date-range bookings. **18 domain tests passed.**

`npm run test:integration` runs 60 assertions against the built Worker with fresh temporary storage. Coverage includes authentication rejection, cross-origin rejection, household isolation, member access across two messes, stale-version conflicts, meals, deposits, deposit corrections and voids, expense submission/review/questions, receipt upload and private retrieval, invalid upload signatures, finalization and durable read-back. The updated suite also races two concurrent payment approvals (one succeeds, one receives 409), checks one linked deposit, rejects unauthorized payments/menu updates, and exercises service availability and meal on/off scheduling.

**Result: all 60 assertions passed.** This suite intentionally uses synthetic identity headers only in a loopback test runtime. Hosted identity remains the responsibility of the Sites authentication proxy.

## Additional checks

- TypeScript check and production build are part of the release checks.
- Desktop and mobile browser checks cover navigation and forms.
- The read-only settlement WebMCP tool was checked with a valid request and rejection of an unexpected argument in the first release.
- An optional GitHub Actions template is included in docs/ci-example.yml. It has not been activated or run remotely; all reported results are local.

## Boundaries

No load test, independent security audit, real money transfer, notification delivery or large-household benchmark was performed. Payment processing and notifications are not features of this release. Local integration results do not imply a guarantee about every user's network, browser or hosting availability.
