# System design and diagrams

These diagrams describe the implementation rather than a hypothetical different stack. Mermaid blocks render in GitHub. In draw.io, use **Insert → Advanced → Mermaid** where available, or recreate the shapes described below.

## Architecture

```mermaid
flowchart LR
  U[Browser: React interface] -->|HTTPS requests| S[Sites authentication and access policy]
  S --> A[Vinext API on Cloudflare Worker]
  A --> R[Business rules and reconciliation]
  A --> D[(D1: household documents)]
  A --> F[(R2: private receipts)]
```

Use rectangles for components, cylinders for storage and arrows for requests. The frontend does not talk directly to storage.

## Use cases

```mermaid
flowchart LR
  M[Member] --> V([View household])
  M --> L([Log own meals])
  M --> E([Submit expense])
  M --> Q([Question expense])
  M --> X([Export settlement])
  G[Manager] --> V
  G --> L
  G --> E
  G --> X
  G --> A([Review expense])
  G --> P([Record or correct deposit])
  G --> C([Finalize completed month])
  G --> N([Manage members])
```

In draw.io use UML actors for Member/Manager and ellipses for the actions. Connect each actor to the actions it is allowed to perform.

## Storage ER diagram

The physical database contains one table. Its JSON field embeds the logical entities below; the relationships are enforced in application code, not SQL foreign keys.

```mermaid
erDiagram
  HOUSEHOLD {
    text id PK
    text owner UK
    text data
    integer version
  }
```

```mermaid
erDiagram
  HOUSEHOLD ||--o{ MEMBER : contains
  HOUSEHOLD ||--o{ EXPENSE : contains
  HOUSEHOLD ||--o{ SETTLEMENT : finalizes
  HOUSEHOLD ||--o{ AUDIT_ENTRY : records
  MEMBER ||--o{ MEAL : consumes
  MEMBER ||--o{ DEPOSIT : contributes
  MEMBER ||--o{ EXPENSE : purchases
  EXPENSE ||--o| RECEIPT : references
```

Use entity rectangles and crow's-foot connectors. One member has many meals; each meal refers to one member. Member/date is unique in the application. One expense may reference zero or one receipt object. A user can participate in multiple households through invitations.

## Class diagram

```mermaid
classDiagram
  class Ledger {
    name: string
    members: Member[]
    meals: Meal[]
    expenses: Expense[]
    deposits: Deposit[]
    closed: monthly snapshots
    history: audit entries
  }
  class Member {
    id: string
    name: string
    email: string
    joined: date
  }
  class Expense {
    amount: integer paisa
    source: fund or personal
    status: pending approved rejected
    paidBy: member ID
  }
  class DomainRules {
    applyAction()
  }
  class Reconciler {
    reconcile()
    allocate()
  }
  Ledger "1" *-- "many" Member
  Ledger "1" *-- "many" Expense
  DomainRules --> Ledger
  Reconciler --> Ledger
```

Boxes group fields and behavior; arrows indicate use or containment. TypeScript uses data types and functions rather than implementing every box as a runtime class.

## DFD Level 0

```mermaid
flowchart LR
  U[Member / manager] -->|Meals, purchases, deposits| P((MessMate))
  P -->|Balances, status, history, exports| U
  I[Identity provider] -->|Authenticated identity| P
```

The circle is the whole process. Rectangles are external actors. Arrows name the information exchanged.

## DFD Level 1

```mermaid
flowchart LR
  U[User] --> P1((1. Check access))
  P1 --> P2((2. Validate action))
  P2 --> D[(Household ledger)]
  P2 --> H[(Embedded audit history)]
  D --> P3((3. Reconcile shares))
  P3 --> U
  U --> P4((4. Validate receipt))
  P4 --> R[(Receipt storage)]
  D --> P5((5. Finalize month))
  P5 --> D
```

Each numbered circle is a sub-process. History is embedded in the same atomic document update as the ledger, not a separate physical database.

## Expense approval sequence

```mermaid
sequenceDiagram
  actor M as Member
  participant UI as Browser
  participant API as API
  participant DB as D1
  actor G as Manager
  M->>UI: Submit purchase
  UI->>API: expense + current version
  API->>API: Authenticate, authorize, validate
  API->>DB: Conditional update + audit entry
  DB-->>API: Updated version
  API-->>UI: Pending expense
  G->>UI: Approve with review note
  UI->>API: review + current version
  API->>DB: Save approval + audit entry
  API-->>UI: Updated ledger
  UI->>UI: Recalculate balances
```

Use actor/lifeline shapes across the top and horizontal message arrows in time order. A stale version produces a conflict response instead of a write.

## Month finalization activity

```mermaid
flowchart TD
  A([Start]) --> B[Manager selects completed month]
  B --> C{Any pending expense or unresolved question?}
  C -->|Yes| D[Resolve records]
  D --> C
  C -->|No| E{Food costs but no meals?}
  E -->|Yes| F[Record missing meals]
  F --> E
  E -->|No| G[Calculate shares and preserve snapshot]
  G --> H[Save snapshot and audit entry atomically]
  H --> I[Block all accounting changes for month]
  I --> J([End])
```

Rounded rectangles mark start/end, rectangles are actions, and diamonds are decisions.

## Design trade-offs

The single-document design makes a household update atomic and easy to understand, but has bounded capacity and scans invited emails. It is suitable for a small mess. A future normalized design would split household membership, meal, expense, deposit, receipt and audit tables and add database-level foreign keys and indexes. Do not claim that the current implementation is normalized.
