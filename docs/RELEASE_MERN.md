# MERN upgrade verification — 28 September 2026

## Implemented

React/Vite/Tailwind frontend, Express/Mongoose backend, public landing/auth screens, independent household membership, rotating managers, expiring invitations, cookie sessions, real verification/reset provider adapters, deposit verification and reversals, cash entries, meal/menu planning, range and recurring exceptions, corrections, bazar duties, advances/returns, expense reviews/questions, stock quantities, notices, in-app notifications, consent-based SMS outbox, reports and effective accounting policies.

Finance uses integer paisa and half-unit meals. Single-document revision updates commit financial transitions and audit/outbox atomically. Idempotency keys persist. Shared MongoDB rate counters cover multiple serverless instances. Finalization blocks unresolved work. Admin reopening preserves the prior report version and suspends dependent future calculations until re-finalization.

## Executed verification

- 11 automated tests passed using Node 24, including real MongoDB replica-set/Supertest integration. These test cases contain multiple assertions covering registration/verification/login/reset, single-use invites, cross-mess rejection, role checks, CSRF, simultaneous deposit approval, durable retry, one-time credit, fractional allocation, Dhaka deadline boundary, atomic range failure, recurring exceptions, advance reservations/returns, personal reimbursements, zero-meal blocking, join/leave occupancy, locking, carry-forward, versioned reopening and migration reconciliation.
- Server and client TypeScript checks passed; server compilation and Vite production build passed in Vercel.
- Backend/frontend dependency audit returned zero reported vulnerabilities after upgrading Nodemailer. This is a dependency database check, not a penetration test.
- Browser verification: public Bengali landing renders; local login reaches workspace; fictional cash deposit saves and changes fund balance by exactly ৳500; deposit history and queued SMS are visible; mobile 390px layout has no document overflow; choosing a mobile menu item closes the drawer.
- Accessible modal components and visible focus are implemented. Mobile drawer keyboard focus handling was improved. Full assistive-technology certification has not been performed.

## Deployment and external dependencies

Public frontend: https://messmate-two.vercel.app  
Express process health: https://messmate-two.vercel.app/api/health  
Database readiness: https://messmate-two.vercel.app/api/ready

The public frontend and process health have been verified without an authenticated Vercel session. The dedicated Atlas MessMate project has a Free cluster. A dedicated readWrite@messmate app user has been created and MONGODB_URI stored in encrypted Vercel production configuration. With explicit owner approval, only the dedicated MessMate project permits dynamic Vercel egress (0.0.0.0/0); database authentication and TLS remain required. Production /api/ready returned 200; logged-out /api/me and /api/messes returned 401. Landing and registration screens were checked in the browser. No old private Site data was made public.

Email verification/reset delivery, SMS delivery and private receipt storage require real provider configuration. The owner confirmed no domain/email provider is available. Registration is visibly disabled until real email verification is configured. These services are **not** live merely because their adapters exist. Missing configuration returns explicit errors or retains queued SMS. No automatic wallet gateway is claimed; all wallet deposits need manual manager verification.

GitHub Actions definition is `.github/workflows/mern.yml`; the workflow performs install, type checks, tests, builds and production-dependency audits. GitHub workflow authorization was obtained. Remote run 36387625282 passed all checks for the initial MERN release. See GitHub Actions for later commits.

## Migration/backup status and remaining limits

- Fixture migration/dry-run reconciliation tested. Real D1 import and receipt-object transfer have not run. Original source/history and private Site remain preserved.
- Account linking requires authenticated old-owner proof plus explicit mapping. It is never granted by unverifiable email alone.
- Production restore rehearsal and automatic encrypted database/object backup scheduling remain operator setup tasks. Atlas Free cluster shows no managed backups.
- Household documents are bounded to 8 MB/100 members; tables paginate within a fetched household aggregate.
- Some advanced operational fields remain English/JSON editors. Full Bengali translation of every operational label is unfinished.
- PDF uses browser Print/Save as PDF. There is no independent PDF-generation service.
- SMS delivery receipts/webhook and retry reconciliation are not automated. `accepted` is not a delivery receipt. No live SMS-provider test has been performed.
- Imported receipts retain original private references; their download migration requires authenticated object copying and checksum verification.

Do not label this entire release complete until live provider flows, migration/cutover, backup verification and deployment smoke tests meet the owner's requirements.
