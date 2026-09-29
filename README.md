# MessMate — shared meals and transparent accounts

MERN upgrade of the existing private MessMate application. React/Vite frontend, Express API, MongoDB/Mongoose persistence, private object-storage adapters and real email/SMS provider interfaces. Existing Vinext/D1/R2 source is retained for migration and rollback.

**Public frontend:** https://messmate-two.vercel.app  
**Process health:** https://messmate-two.vercel.app/api/health  
**Readiness:** https://messmate-two.vercel.app/api/ready

The MERN app is deployed publicly with Atlas, verified Brevo email delivery, private Vercel Blob receipts and encrypted daily backups. Source visibility is public at the owner's request; private mess data requires sign-in and membership. The owner chose free email/in-app notifications and deferred SMS. See [release verification](docs/RELEASE_MERN.md) and [backup recovery](docs/BACKUP_RESTORE.md) for evidence and operating limits. The legacy private D1 household was inspected and contains no financial records to migrate.

## Run the MERN application

Use Node 24 and a MongoDB replica set.

```sh
npm ci --prefix server
npm ci --prefix client
# Copy server/.env.example to server/.env and configure services.
npm run dev --prefix server
# In another terminal:
npm run dev --prefix client
```

Tests: `npm test --prefix server`. Build: `npm run build --prefix server` and `npm run build --prefix client`. A disposable local preview is available with `npm run preview:local --prefix server`; its database and mail sink must never be used as production infrastructure.

## Implemented workflows

- Public Bengali/English landing, account verification/reset, secure revocable sessions, mess switcher and invitation-based membership.
- Admin/monthly manager/member authorization and isolated household records.
- Daily menus, meal deadlines, half/guest portions, date ranges, recurring preferences with exceptions and correction requests.
- A single **Deposits** area for bKash/Nagad/Rocket manual submissions and manager-entered cash; approval, duplicate protection, voids, audit, email confirmation and in-app notifications.
- Bazar duties, advances/returns, reviewed expenses, personal purchases, actual reimbursements/refunds and quantity stock.
- Effective category rules, paisa allocation, immutable month close, carry-forward, CSV and printable statements.
- Versioned atomic financial mutations, durable retry keys, shared rate counters, private uploads and migration reconciliation tooling.

## Documentation

- [Audit, Bangladesh workflow research and decisions](docs/MERN_AUDIT.md)
- [Local setup, Vercel configuration and manager checklist](docs/MERN_SETUP.md)
- [Architecture and API](docs/MERN_API.md)
- [Migration, identity mapping, backup and rollback](docs/MERN_MIGRATION.md)
- [Release verification and limitations](docs/RELEASE_MERN.md)
- [Preserved legacy instructions](docs/LEGACY_README.md)

`client/` and `server/` are the new application; `api/` adapts Express to Vercel. Root `app/`, `lib/`, Workers and D1 migrations remain legacy source. Root legacy commands are retained with a `legacy:` prefix. Neither repository visibility nor old private data access should change as part of public website deployment.

## Navigation and reliability upgrade
See [release changes and manager checklist](docs/UPGRADE_2026_09.md). Workspace routes, account-aware branding, bounded data refresh, member identity, mobile record cards and independent notification operations extend the existing financial rules. [Architecture](docs/ARCHITECTURE.md).
