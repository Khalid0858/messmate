import { test } from "node:test";
import assert from "node:assert/strict";
import {
  action,
  allocate,
  createLedger,
  settlement,
  type Actor,
} from "../src/domain.ts";
const now = new Date("2026-09-20T03:59:00Z");
const admin: Actor = {
  userId: "u1",
  memberId: "m1",
  name: "Admin",
  email: "admin@example.test",
  admin: true,
  manager: true,
};
const user: Actor = {
  userId: "u2",
  memberId: "m2",
  name: "Member",
  email: "member@example.test",
  admin: false,
  manager: false,
};
function fixture() {
  const d = createLedger("Test mess", {
    id: "m1",
    userId: "u1",
    name: "Admin",
    email: admin.email,
    joined: "2026-08-01",
  });
  d.members.push({
    id: "m2",
    userId: "u2",
    name: "Member",
    email: user.email,
    joined: "2026-08-01",
  });
  return d;
}
test("largest remainder conserves paisa across fractional units", () => {
  for (let n = 0; n < 200; n++)
    assert.equal(
      allocate(n, [1, 2, 3]).reduce((a, b) => a + b, 0),
      n,
    );
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
});
test("privileged reopening preserves old snapshot and suspends later balances until reclose", () => {
  let d = action(
    fixture(),
    "deposit_cash",
    { memberId: "m1", date: "2026-08-20", amount: "10" },
    admin,
    now,
  );
  d = action(d, "close", { month: "2026-08" }, admin, now);
  const original = structuredClone(d.closed["2026-08"]);
  assert.throws(
    () =>
      action(d, "reopen", { month: "2026-08", reason: "Fix cash" }, user, now),
    /Admin/,
  );
  d = action(
    d,
    "reopen",
    { month: "2026-08", reason: "Correct missing cash" },
    admin,
    now,
  );
  assert.throws(() => settlement(d, "2026-09"), /reopened earlier month/);
  d = action(
    d,
    "deposit_cash",
    { memberId: "m1", date: "2026-08-21", amount: "1" },
    admin,
    now,
  );
  d = action(d, "close", { month: "2026-08" }, admin, now);
  assert.deepEqual(d.versions!["2026-08"][0], original);
  assert.equal(d.closed["2026-08"].version, 2);
  assert.equal(settlement(d, "2026-09").rows[0].opening, -1100);
});
test("occupancy allocation respects join/leave dates and personal reimbursement signs", () => {
  let d = fixture();
  d.members[1].joined = "2026-08-16";
  d.members[1].left = "2026-08-31";
  d.rules[0].categories.rent = "occupancy";
  d = action(
    d,
    "expense",
    {
      paidBy: "m1",
      date: "2026-08-20",
      amount: "47",
      title: "Rent",
      category: "rent",
      source: "personal",
    },
    admin,
    now,
  );
  d = action(
    d,
    "expense_review",
    { id: d.expenses[0].id, status: "approved", reason: "Verified" },
    admin,
    now,
  );
  let r = settlement(d, "2026-08");
  assert.deepEqual(
    r.rows.map((x) => x.cost),
    [3100, 1600],
  );
  assert.equal(r.cash, 0);
  assert.equal(r.rows[0].due, -1600);
  d = action(
    d,
    "transfer",
    {
      memberId: "m1",
      date: "2026-08-21",
      type: "reimbursement",
      amount: "47",
      note: "Actual payout",
    },
    admin,
    now,
  );
  r = settlement(d, "2026-08");
  assert.equal(r.cash, -4700);
  assert.equal(r.rows[0].due, 3100);
  assert.throws(
    () =>
      action(
        d,
        "transfer",
        {
          memberId: "m1",
          date: "2026-08-22",
          type: "reimbursement",
          amount: "1",
          note: "Duplicate",
        },
        admin,
        now,
      ),
    /exceeds unreimbursed/,
  );
});
test("member cannot change another member or assign manager", () => {
  assert.throws(
    () =>
      action(
        fixture(),
        "meal",
        {
          memberId: "m1",
          date: "2026-09-21",
          breakfast: 1,
          lunch: 0,
          dinner: 0,
        },
        user,
        now,
      ),
    /own record/,
  );
  assert.throws(
    () =>
      action(
        fixture(),
        "manager",
        { memberId: "m2", month: "2026-09" },
        user,
        now,
      ),
    /Admin/,
  );
});
test("Dhaka deadline boundary and failed range are atomic", () => {
  const d = fixture();
  const payload = {
    memberId: "m2",
    date: "2026-09-20",
    breakfast: 0.5,
    lunch: 1,
    dinner: 2,
  };
  assert.equal(action(d, "meal", payload, user, now).meals[0].breakfast, 1);
  assert.throws(
    () => action(d, "meal", payload, user, new Date("2026-09-20T04:00:00Z")),
    /deadline/,
  );
  assert.throws(
    () =>
      action(
        d,
        "meal_range",
        { ...payload, start: "2026-09-19", end: "2026-09-21" },
        user,
        now,
      ),
    /deadline/,
  );
  assert.equal(d.meals.length, 0);
});
test("recurring preferences preserve explicit exceptions", () => {
  let d = action(
    fixture(),
    "meal",
    { memberId: "m2", date: "2026-09-21", breakfast: 0, lunch: 0, dinner: 0 },
    user,
    now,
  );
  d = action(
    d,
    "recurring",
    {
      memberId: "m2",
      start: "2026-09-21",
      end: "2026-09-22",
      weekdays: [1, 2],
      breakfast: 1,
      lunch: 1,
      dinner: 1,
    },
    user,
    now,
  );
  assert.equal(d.meals.length, 2);
  assert.equal(d.meals.find((x) => x.date === "2026-09-21")!.lunch, 0);
});
test("manual deposits remain pending, reject duplicate and repeated approval; void reverses credit", () => {
  let d = action(
    fixture(),
    "account",
    {
      provider: "bKash",
      number: "01700000000",
      name: "Manager",
      instructions: "Send money",
      enabled: true,
    },
    admin,
    now,
  );
  const p = {
    memberId: "m2",
    date: "2026-09-20",
    amount: "100.01",
    provider: "bKash",
    transactionId: "ABC123",
  };
  d = action(d, "deposit_submit", p, user, now);
  assert.equal(settlement(d, "2026-09").cash, 0);
  assert.throws(
    () =>
      action(d, "deposit_submit", { ...p, transactionId: "abc123" }, user, now),
    /already submitted/,
  );
  const review = {
    id: d.deposits[0].id,
    status: "approved",
    verified: true,
    reason: "Matched wallet",
  };
  d = action(d, "deposit_review", review, admin, now);
  assert.equal(settlement(d, "2026-09").cash, 10001);
  assert.throws(
    () => action(d, "deposit_review", review, admin, now),
    /already reviewed/,
  );
  d = action(
    d,
    "deposit_void",
    { id: review.id, reason: "Wrong sender" },
    admin,
    now,
  );
  assert.equal(settlement(d, "2026-09").cash, 0);
  assert.equal(d.outbox.length, 2);
});
test("advance purchases count once and returns cannot exceed unspent cash", () => {
  let d = action(
    fixture(),
    "deposit_cash",
    { memberId: "m1", date: "2026-09-20", amount: "1000" },
    admin,
    now,
  );
  d = action(
    d,
    "advance",
    { memberId: "m2", date: "2026-09-20", amount: "500", note: "Bazar" },
    admin,
    now,
  );
  d = action(
    d,
    "expense",
    {
      paidBy: "m2",
      date: "2026-09-20",
      amount: "300",
      title: "Rice",
      category: "rent",
      source: "advance",
      advanceId: d.advances[0].id,
    },
    user,
    now,
  );
  assert.throws(
    () =>
      action(
        d,
        "advance_return",
        { id: d.advances[0].id, date: "2026-09-20", amount: "201" },
        admin,
        now,
      ),
    /exceeds/,
  );
  d = action(
    d,
    "expense_review",
    { id: d.expenses[0].id, status: "approved", reason: "Receipt checked" },
    admin,
    now,
  );
  d = action(
    d,
    "advance_return",
    { id: d.advances[0].id, date: "2026-09-20", amount: "200" },
    admin,
    now,
  );
  assert.equal(settlement(d, "2026-09").cash, 70000);
  assert.equal(settlement(d, "2026-09").totalCosts, 30000);
});
test("zero-meal food month cannot close; finalized month locks and carries once", () => {
  let d = action(
    fixture(),
    "expense",
    {
      paidBy: "m1",
      date: "2026-08-20",
      amount: "1.01",
      title: "Food",
      category: "food",
      source: "personal",
    },
    admin,
    now,
  );
  d = action(
    d,
    "expense_review",
    { id: d.expenses[0].id, status: "approved", reason: "Checked" },
    admin,
    now,
  );
  assert.equal(settlement(d, "2026-08").unallocated, 101);
  assert.throws(
    () => action(d, "close", { month: "2026-08" }, admin, now),
    /no eligible/,
  );
  d = action(
    d,
    "meal",
    {
      memberId: "m1",
      date: "2026-08-20",
      breakfast: 0.5,
      lunch: 1,
      dinner: 0,
      reason: "Register correction",
    },
    admin,
    now,
  );
  d = action(d, "close", { month: "2026-08" }, admin, now);
  assert.throws(
    () =>
      action(
        d,
        "deposit_cash",
        { memberId: "m1", date: "2026-08-20", amount: "1" },
        admin,
        now,
      ),
    /finalized/,
  );
  assert.deepEqual(
    settlement(d, "2026-09").rows.map((r) => r.opening),
    d.closed["2026-08"].rows.map((r: any) => r.due),
  );
  assert.equal(d.closed["2026-08"].totalCosts, 101);
});
