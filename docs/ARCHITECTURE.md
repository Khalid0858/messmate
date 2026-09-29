# MERN architecture

```mermaid
flowchart LR
 Browser[React / Vite / Router / Query] -->|HTTPS + HttpOnly session + CSRF| API[Express on Vercel]
 API -->|authorization + validation| Domain[Integer-paisa financial domain]
 Domain -->|revision compare-and-swap| Mongo[Atlas: users / bounded mess ledgers / upload metadata]
 API --> Blob[Private Vercel Blob receipts]
 API --> Outbox[Durable ledger outbox]
 Actions[GitHub Operations schedule] -->|server secret| Jobs[Notification dispatch + monitoring]
 Jobs --> Outbox
 Jobs --> SMTP[Brevo SMTP]
 Cron[Vercel daily cron] --> Backup[Encrypted backup]
 Backup --> Mongo
 Backup --> Blob
```

The browser never has database, SMTP, Blob or cron credentials. Invitation tokens are hashed at rest. Every mess route checks membership; every mutation revalidates role and document revision. See UPGRADE_2026_09.md for limits, failure semantics and rollback.
