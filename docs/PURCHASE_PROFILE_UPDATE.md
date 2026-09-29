# Purchase and personal profile update — 29 September 2026

## What changed
- Item quantity and price start empty and can be cleared. Decimal price input preserves its typed text; submission converts to integer paisa. The total below the item list is calculated from item totals. With no item lines, enter the total in the bottom amount field. The server still reconciles item sums against the submitted expense.
- New bazar entries require a private JPG/PNG/WebP photo (4 MB maximum). PDF receipts remain readable for older records and other existing receipt workflows; a PDF does not satisfy the new bazar-photo requirement. The API checks stored image metadata and uploader access, not just the browser's required attribute.
- Use the duty row's **Submit expense** to link the purchase to that duty and preselect the assignee. **Complete** is enabled only after a matching, non-rejected photo expense has been saved. Pending review is sufficient: completion records the shopping work, while expense approval remains the manager's separate financial decision. The server enforces the same rule. Old completed duties are preserved.
- Sidebar badges count each section's own unread notifications and manager review queue. Meal corrections do not inflate Deposits. Badge accessibility labels distinguish unread events from records awaiting review.
- `/app/profile` contains name, optional phone/address/occupation/bio, and a private profile photo (JPG/PNG/WebP, 2 MB maximum). Only the signed-in account can read its personal information/photo. Mess members do not receive profile addresses or photo keys. Existing member ledger names/history are preserved.
- Settings offers language, browser-local table spacing, password-reset entry and sign-out of all other devices. Current session remains active. SMS stays disabled.
- Public footer now has product/support columns; app footer has compact profile/help/privacy/terms links. Khalid Hasan copyright is retained.

## Additive data changes
Optional User fields: address, occupation, bio, avatarKey. Expense dutyId links to the existing duty record. No bulk rewrite, destructive migration or financial balance change. Upload metadata uses a reserved `profile:<userId>` scope for private profile objects; existing backup capture includes all Upload references and their bytes. Replaced profile photos remain private and may remain in backup/retention storage.

## Validation
Server domain/API tests cover photo requirements, expense sums, assignee matching, rejection/completion, avatar authentication/isolation, private profile persistence and other-session revocation. Browser tests exercise empty/decimal item input, computed bottom total, mandatory photo, linked duty completion, separate badges, profile persistence/photo and mobile preferences. Run the GitHub MERN checks workflow for the exact deployed commit; production financial test records are never created.

## API additions
- PATCH /api/me accepts optional address (300 chars), occupation (80), bio (500), alongside existing name/phone/smsConsent.
- POST /api/me/avatar: authenticated CSRF-protected multipart file; GET /api/me/avatar: owner-only private image.
- POST /api/me/revoke-other-sessions: authenticated CSRF-protected revocation excluding the current session.
- expense payload accepts dutyId and kind=bazar. Food/itemized/duty-linked purchases also enforce bazar photo validation for older clients.

## Rollback
Promote the previous known-good deployment without replacing the database. Optional fields do not change settlement arithmetic. Rolling back also removes the new photo/completion protections from that version; preserve the new records and restrict new bazar entries until corrected deployment is restored.
