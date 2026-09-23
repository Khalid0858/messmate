# API reference

## Wallet and planning actions

All use the existing authenticated, same-origin `POST /api/ledger` envelope with `householdId`, current `version`, `action` and `payload`.

| Action | Payload | Permission |
|---|---|---|
| `payment_account` | provider, number, name, instructions, enabled (`yes`/`no`) | Manager |
| `payment_submit` | memberId, provider, transactionId, amount (BDT decimal string), sender, date | Own member, or manager |
| `payment_review` | id, status (`approved`/`rejected`), reviewNote, verified (`on` required for approval) | Manager |
| `menu` | date; breakfast/lunch/dinner each with suffix Enabled (`yes`/`no`), Menu, Cutoff (`HH:mm`) | Manager |
| `meal_range` | memberId, start, end, breakfast, lunch, dinner | Own member, or manager |

Rule failures return 400; stale/concurrent versions return 409. A successful payment approval and linked deposit persist in the same write. A linked deposit can be voided with `void_deposit`, but cannot be edited. The new `payments`, `paymentAccounts`, `menus` collections are optional on older saved documents. See [operating guide](PAYMENTS_AND_MEALS.md) for privacy and accounting rules.

All responses are JSON unless downloading a receipt. Hosted authentication is supplied by Sites. Never expose a Worker directly to the public internet while treating client-supplied identity headers as trusted.

## Load a household

`GET /api/ledger?household=<optional-id>`

Returns `data`, `version`, `role`, `memberId`, `householdId`, and the `workspaces` this user can access. Without a household ID, the owner workspace is preferred. A new empty workspace is created only if the user has no accessible workspace.

## Submit a change

`POST /api/ledger`

Use `Content-Type: application/json`. Browser requests must have the same Origin as the application. Always send the latest version returned by the server.

```json
{
  "householdId": "id-returned-by-server",
  "version": 4,
  "action": "meal",
  "payload": {
    "memberId": "existing-member-id",
    "date": "2026-09-22",
    "breakfast": 1,
    "lunch": 1,
    "dinner": 0
  }
}
```

| Action | Required payload | Permission |
|---|---|---|
| `member` | name, email, joined | Manager |
| `member_edit` | id, name, email | Manager |
| `meal` | memberId, date, breakfast, lunch, dinner | Own meals before deadline; manager corrections |
| `expense` | title, date, amount, category, source, paidBy; optional receipt | Member's own purchase or manager |
| `deposit` | memberId, date, amount, note | Manager |
| `deposit` correction | Above fields plus id and reason | Manager; original and new month both open |
| `void_deposit` | id, reason | Manager; month open |
| `review` | id, status (`approved`/`rejected`), resolution | Manager |
| `question` | id, question | Household participant |
| `settings` | name | Manager |
| `close` | month (`YYYY-MM`) | Manager; completed month with no pending issues |

Money inputs are taka strings or numbers with at most two decimals. Stored amounts and settlement outputs are integer paisa. Categories are `food`, `rent`, `utilities`; sources are `fund` or `personal`.

## Receipts

`POST /api/receipt?household=<id>` accepts multipart form data with a `file` field and returns a storage `key`. Attach that key when submitting the expense.

`GET /api/receipt?key=<key>` checks household access and returns the file with private/no-store caching and sandboxed content.

## Errors

| Status | Meaning | What to do |
|---|---|---|
| 400 | Invalid field or business rule | Correct the input; keep the form open |
| 401 | Not signed in | Complete sign-in |
| 403 | Unavailable household or wrong request origin | Use an authorized account and the app's origin |
| 404 | Receipt missing | Verify the stored receipt reference |
| 409 | Another change was saved first | Reload, review current values, then resubmit |
| 413 | Request/file too large | Reduce payload size |
| 415 | Wrong media type | Send JSON to the ledger endpoint |
| 503 | Storage unavailable | Retry after service recovery |

## Local testing and Postman

The local development server has a simulated sign-in. Open `/signin-with-chatgpt?return_to=/` in your browser. For Postman, use only the local development cookie, the local Origin, and the current version from GET. Do not copy production cookies into shared collections. The automated integration runner exercises equivalent HTTP requests and is restricted to localhost.
