# MERN upgrade audit · 23 September 2026

The v3 deployed source is preserved at commit `21c2083c5d7c236c722bfeba732ea8e28b4b7e89`. It has working meal, wallet-verification, expenses, deposits, menus, household isolation and fixed-category settlement. It depends on Sites identity, D1 and R2; it is not MERN. Existing tests: 18 domain tests and 60 isolated Worker assertions.

New work: public account authentication, MongoDB/Mongoose persistence, rotating manager authorization, effective rules, half meals/recurrence, correction requests, bazar assignment/advances, stock movements, carry-forward, notifications, migration and public landing/application design. Deposit is the only money-entry navigation: wallet submissions and cash records live together. The legacy `payments` collection is an import detail, not a separate new screen.

## Research and assumptions

- [MessMax](https://messmax.net/) describes fractional meals, manager rotation, invitations and several mess memberships. These are observed product workflows, not evidence that every Bangladesh mess uses the same rules.
- [My Meal BD](https://mymealbd.com/) describes admin/member roles and approval of deposits and bazar entries.
- Inference/design choice: configure split rules per category and effective month; do not assert a universal breakfast weight or cook-salary policy.
- Default: confirmed bookings are billable, half units are allowed, stock is quantity-only and does not deduct expenses again. Inventory valuation is deliberately excluded to prevent unsupported double deductions.

## Architecture decision

React/Vite frontend and Express serve one origin. MongoDB holds users, revocable sessions, one-use auth tickets, uploads and versioned mess aggregates. Financial records, audit history and notification outbox change in one atomic aggregate update; no cross-document money movement. Unique user/session/token indexes and aggregate revision/idempotency keys protect identity and financial writes. Aggregate limits are explicit; this is a small-household architecture, not an unbounded enterprise ledger.

The old private deployment is preserved until production infrastructure, identity claims, data migration and reconciliation are verified. Public deployment exposes registration/landing, never the ledger. MongoDB, storage, email/SMS credentials and hosting access are external setup dependencies, not simulated features.
