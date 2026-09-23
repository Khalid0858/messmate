# Requirements and scope

## Problem and motivation

People living in a student mess often record meals and grocery purchases in separate notebooks or chat messages. A missing meal, a duplicate deposit, or a purchase paid personally can make the final bill difficult to explain. MessMate gives a household a shared record and an auditable settlement process.

## Objectives

- To record daily meals for each member.
- To distinguish personal purchases from shared-fund purchases.
- To approve expenses and resolve questions before finalization.
- To calculate exact monthly shares without losing money to rounding.
- To preserve corrections and protect closed accounting periods.
- To provide a responsive interface and exportable reports.

## Users

| Role | Permissions |
|---|---|
| Guest | Explore a clearly labeled, read-only sample workspace |
| Member | View their household, log their own meals before the deadline, submit their own expenses, question expenses, export settlement |
| Manager | Manage members, correct any open-period meals, record/correct/void deposits, review expenses, rename mess, finalize completed months |

The hosted Site also has an access policy. A person must be allowed by that policy and be a household owner or invited member. Adding an email in Members does not automatically widen Site sharing.

## Functional requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| FR01 | Identify signed-in users | Anonymous API requests return 401 |
| FR02 | Separate household records | An unrelated user cannot read or mutate a household |
| FR03 | Manage members | Names/emails are validated; duplicate member emails are rejected |
| FR04 | Track meals | One record per member/date; corrections replace counts and preserve history |
| FR05 | Enforce deadlines | Members cannot change today's meals after 10:00 AM Asia/Dhaka; managers can correct open months |
| FR06 | Submit expenses | New purchases are pending until manager review |
| FR07 | Review and question | Unresolved questions or pending expenses prevent finalization |
| FR08 | Store receipts | JPEG/PNG/WebP/PDF files up to 5 MB; household access enforced |
| FR09 | Track deposits | Only managers record, correct or void deposits; corrections require reasons |
| FR10 | Reconcile | Food is allocated by meals, rent/utilities equally; total allocated paisa equals approved spending |
| FR11 | Close a month | Only completed months can close; their data cannot then change |
| FR12 | Export | Settlement downloads as CSV with spreadsheet-formula injection protection |
| FR13 | Switch mess | A person explicitly selects among their accessible households |
| FR14 | Preserve history | Successful changes record actor, time and meaningful change details |
| FR15 | Handle concurrent edits | Stale versions return 409 instead of overwriting another person's work |

## Non-functional requirements

FR16: Managers configure receiving accounts for bKash, Nagad and Rocket. Members submit references; only verified approvals create deposits. Duplicate references and concurrent double credit are rejected. All decisions retain timestamps and actors.

FR17: Managers publish date-specific menus, availability and cutoffs. Members schedule their own meal counts over 1–31 days; invalid ranges fail atomically. Existing reservations prevent silent service cancellation.

The original FR05 10:00 AM cutoff applies only when no daily menu is published; published menus use per-meal Bangladesh-time deadlines.

- **Security:** server-side permissions, bound SQL parameters, same-origin mutations, upload checks and private receipt retrieval.
- **Privacy:** household information is not public; no passwords or payment credentials are stored by the app.
- **Reliability:** each ledger change and its audit message save atomically. Rejected requests do not persist partial ledger changes.
- **Availability:** the hosted application depends on Sites and its underlying storage services. No specific uptime guarantee is claimed.
- **Performance:** this version targets small households, up to 100 members and a 1.5-million-character ledger. Large organizations are outside its scope.
- **Scalability:** a normalized schema and paginated queries should replace the document model for large deployments.
- **Usability:** labeled forms, visible validation errors, clear zero states and explained bills.
- **Responsiveness:** desktop sidebar, mobile navigation sheet, adaptive cards and horizontally scrollable data tables.
- **Maintainability:** typed domain models, separated calculation/business-rule/API modules, automated tests and documented interfaces.

## Explicit boundaries

This release does not transfer money, send email/SMS, prorate shared costs, automatically carry balances forward, manage member departures, or reopen finalized months. Expenses can be corrected by rejecting the wrong record with a reason and submitting its replacement. Household switching is supported; independent public password registration is not, because the hosted app uses ChatGPT sign-in.
