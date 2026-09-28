import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateLedger } from "../src/migration.ts";
import { emptyLedger, reconcile } from "../../lib/ledger.ts";
import { settlement, action } from "../src/domain.ts";
test("migration preserves history, linked deposit credit, closed balances and reviewed opening", () => {
  const old = emptyLedger();
  old.members = [
    {
      id: "m1",
      name: "Owner",
      email: "owner@example.test",
      joined: "2026-01-01",
    },
  ];
  old.meals = [
    {
      id: "meal1",
      memberId: "m1",
      date: "2026-08-20",
      breakfast: 0.5,
      lunch: 1,
      dinner: 0,
    },
  ];
  old.expenses = [
    {
      id: "exp1",
      date: "2026-08-20",
      title: "Food",
      category: "food",
      amount: 12345,
      paidBy: "m1",
      source: "fund",
      status: "approved",
    },
  ];
  old.deposits = [
    {
      id: "dep1",
      memberId: "m1",
      date: "2026-08-20",
      amount: 15000,
      note: "Mobile",
      paymentId: "pay1",
    },
  ];
  old.payments = [
    {
      id: "pay1",
      memberId: "m1",
      date: "2026-08-20",
      amount: 15000,
      provider: "bKash",
      transactionId: "ABC12345",
      recipient: "01700000000",
      senderLast4: "1234",
      status: "approved",
      submittedAt: "2026-08-20T00:00:00Z",
      submittedBy: "oldUser",
      depositId: "dep1",
    },
  ];
  old.closed["2026-08"] = {
    at: "2026-09-01T00:00:00Z",
    rows: reconcile(old, "2026-08").rows,
  };
  const mapping = {
    legacyId: "d1-mess-1",
    cutover: "2026-09",
    ownerMemberId: "m1",
    ownerUserId: "newUser",
    openingBalances: { m1: -2655 },
  };
  const result = migrateLedger(old, mapping);
  assert.equal(result.data.deposits.length, 1);
  assert.equal(result.data.meals[0].breakfast, 1);
  assert.equal(result.data.closed["2026-08"].rows[0].due, -2655);
  assert.equal(settlement(result.data, "2026-09").rows[0].opening, -2655);
  assert.deepEqual(result.data.legacy!.source, old);
  assert.equal(
    migrateLedger(old, mapping).report.sourceHash,
    result.report.sourceHash,
  );
  assert.throws(
    () => migrateLedger(old, { ...mapping, openingBalances: {} }),
    /Every legacy/,
  );
  assert.throws(
    () =>
      action(
        result.data,
        "deposit_cash",
        { memberId: "m1", date: "2026-08-20", amount: 1 },
        {
          userId: "newUser",
          name: "Owner",
          email: "owner@example.test",
          admin: true,
          manager: true,
          memberId: "m1",
        },
      ),
    /read-only/,
  );
});
