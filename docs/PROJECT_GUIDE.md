# MessMate: project guide

MessMate helps a shared household track meals, expenses and contributions, then explain each person's monthly balance.

## Getting started

1. Open the app and sign in with ChatGPT. The deployed Site is owner-private.
2. In Settings, enter your mess name.
3. Add yourself and your housemates in Members. Set their actual joining dates. Dates cannot affect a finalized month.
4. Use Meal tracker to record breakfast, lunch and dinner. Each counts as one meal; zero means absent. Guest meals can be included in the host's count.
5. Record money actually received under Deposits. This is bookkeeping, not an online payment.
6. Add purchases under Expenses. Choose whether payment came from the shared fund or a member's personal money.
7. Review expenses to approve or reject them. Members can question expenses before finalization. A manager records a resolution.
8. Review Settlement and export CSV. Once the month has ended and all questions and pending expenses are resolved, finalize it.

Finalized months cannot be edited or reopened. Credits are amounts to refund or settle manually, not automatic transfers. Do not finalize until all records have been checked.

## How the calculation works

All money is stored as integer paisa: 100 paisa = 1 taka. This prevents common decimal rounding errors.

- Food share = approved food expenses × member's meals ÷ total meals.
- Shared costs = approved rent and utilities ÷ eligible members.
- Balance = food share + shared costs − deposits − approved personal purchases.
- Positive balance: member owes money. Negative balance: credit or refund due.
- Cash in hand for the selected month = deposits − approved purchases paid from the mess fund.

Example: food costs ৳900, A eats 6 meals and B eats 3. Their food shares are ৳600 and ৳300. If A personally bought all ৳900 of food, A receives a ৳900 credit. That purchase does not also reduce the mess fund.

Rounding uses the largest-remainder method. First allocate whole paisa, then distribute remaining paisa to the largest fractions. Ties follow member order. Allocated shares exactly match the expense total.

Shared expenses are split equally among people whose joining month is no later than the selected month, without proration. The first version does not support member departures, unequal meal weights, or automatic carry-forward balances.

## Architecture, explained simply

The frontend is the interactive screen. The backend checks permission and rules. The database remembers accepted changes. An API is the doorway through which the frontend asks the backend to do work.

Browser → React interface → HTTP API → validation and accounting rules → Cloudflare D1 database.

Receipt files go to Cloudflare R2 storage; their references are saved alongside expenses.

The implemented stack is TypeScript, React, Vinext, Cloudflare D1/SQLite, and R2. The earlier Django/PostgreSQL suggestion was provisional. This stack was chosen to support a working hosted app on Sites with integrated sign-in and persistence. No AI or paid messaging service is needed.

## Source map

| File | Purpose |
|---|---|
| `app/messmate.tsx` | Dashboard, forms, registers, settlement and navigation |
| `app/messmate.css` | Product styling and responsive layouts |
| `app/api/ledger/route.ts` | Load records and accept validated changes |
| `app/api/receipt/route.ts` | Upload and securely retrieve receipts |
| `lib/ledger.ts` | Types, sample data and reconciliation mathematics |
| `lib/actions.ts` | Business rules, permission checks and history messages |
| `lib/server.ts` | Signed-in identity, household lookup and database access |
| `db/schema.ts` | Database schema |
| `drizzle/` | Versioned SQL migration and generated metadata |
| `tests/ledger.test.ts` | Accounting and authorization tests |
| `scripts/test.mjs` | Portable test runner |

## Storage design

`households` has an ID primary key, a unique owner ID, a JSON data document and an integer version. The JSON document contains members, meals, expenses, deposits, finalized settlements and append-only change history.

This is a deliberate small-household design: one conditional update atomically saves a transaction and its audit entry. A version check prevents two people from silently overwriting each other. SQL uses bound parameters.

This is not a fully normalized relational schema. A larger deployment should migrate to separate member, meal, expense, deposit and audit tables, with explicit memberships and indexes. Current limits are 100 members and a 1.5-million-character household document.

## Authentication and privacy

Hosted sign-in is supplied by Sites/ChatGPT. MessMate never stores passwords. Server code checks identity on every API request and distinguishes manager actions from member actions. Only explicit member emails grant access to that household, subject to the Site's access policy. An existing household owner remains attached to their own household.

The production Site is private to its owner. Adding a member does not change platform access or send an invitation email. Multi-person use requires the owner to intentionally change the Site's sharing policy. A member should be added before their first sign-in; switching between households is not supported in this version.

For development only, the bundled preview sign-in uses `seedy@sites.test`. That simulated identity is not included in production builds. Public account registration, password recovery, email delivery and payment gateways are not implemented.

Mutations require a same-origin request. User text is rendered through React rather than raw HTML. Receipt uploads allow JPEG, PNG, WebP and PDF, validate signatures, and limit files to 5 MB. Receipts are private to their household. Uploads that are not attached to an expense are not automatically cleaned up yet.

## Testing performed

Nine automated domain tests cover rounding, personal-purchase credit, pending-expense exclusion, meal corrections, role rules, Bangladesh time deadlines, finalized months, invalid inputs and expense-question resolution.

Local integration tests exercised sign-in, save/reload, all core record writes, approval and dispute resolution, finalization, stale-write rejection, cross-origin rejection, receipt upload/read and receipt access denial. Browser checks covered adding a member, responsive mobile layout and the read-only settlement WebMCP tool including rejection of invalid input.

These tests establish the implemented behavior; they are not a professional security audit or a substitute for a pilot with real users.

## Running locally

Install Node.js 22.13 or newer, then open a terminal in the project folder:

```sh
npm ci
npm test
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_careless_dazzler.sql
npm run dev
```

Run the migration once for a fresh local database. Open the Local URL printed by the development server. Production and local databases are separate. The initial production workspace is empty.

When changing the database schema, run `npm run db:generate`, inspect the new migration, and preserve already-applied migration files. Use `npm run typecheck` after code changes.

## University presentation

Problem: shared households struggle to agree on fair, traceable meal bills.

Objectives:
- To record individual meal consumption accurately.
- To distinguish shared-fund spending from personally funded purchases.
- To calculate transparent monthly balances with exact rounding.
- To support expense review and dispute resolution before settlement.
- To prevent unauthorized changes and preserve finalized records.

Suggested demonstration: add members → log meals → record a deposit → submit a personal purchase → approve it → explain its effect on settlement → raise and resolve a question → export → finalize a completed month.

Useful future work: member departures, explicit invitations and household switching, reversible deposit corrections, richer backups, automated reminder delivery and a normalized database for larger deployments.
