import assert from "node:assert/strict";
import { test } from "node:test";
import { allocate, emptyLedger, reconcile } from "../lib/ledger";
import { applyAction } from "../lib/actions";
const now = new Date("2026-09-21T06:00:00Z");
const auth = { manager: true, email: "manager@example.com", household: "test" };
const memberAuth = { ...auth, manager: false, memberId: "a" };
function paymentFixture() {
  const d = fixture();
  applyAction(
    d,
    "payment_account",
    {
      provider: "bKash",
      number: "01700000000",
      name: "Test account",
      instructions: "Send Money",
      enabled: "yes",
    },
    auth,
    now,
  );
  return d;
}
const paymentPayload = {
  memberId: "a",
  provider: "bKash",
  transactionId: "ABC123XYZ",
  sender: "01800000000",
  date: "2026-09-20",
  amount: "250.50",
};
test("pending wallet submission does not credit money; approval credits exactly once", () => {
  const d = paymentFixture();
  applyAction(d, "payment_submit", paymentPayload, memberAuth, now);
  assert.equal(reconcile(d, "2026-09").deposits, 0);
  assert.equal(d.payments![0].senderLast4, "0000");
  assert.ok(!JSON.stringify(d.payments).includes(paymentPayload.sender));
  const p = {
    id: d.payments![0].id,
    status: "approved",
    reviewNote: "Matched wallet transaction",
    verified: "on",
  };
  applyAction(d, "payment_review", p, auth, now);
  assert.equal(reconcile(d, "2026-09").deposits, 25050);
  assert.throws(
    () => applyAction(d, "payment_review", p, auth, now),
    /already been reviewed/,
  );
  assert.equal(d.deposits.length, 1);
});
test("duplicate payment references and unauthorized approval are rejected", () => {
  const d = paymentFixture();
  applyAction(d, "payment_submit", paymentPayload, memberAuth, now);
  assert.throws(
    () =>
      applyAction(
        d,
        "payment_submit",
        { ...paymentPayload, transactionId: "abc123xyz" },
        memberAuth,
        now,
      ),
    /already been submitted/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "payment_review",
        {
          id: d.payments![0].id,
          status: "approved",
          reviewNote: "x",
          verified: "on",
        },
        memberAuth,
        now,
      ),
    /manager/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "payment_review",
        { id: d.payments![0].id, status: "approved", reviewNote: "x" },
        auth,
        now,
      ),
    /Confirm/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "payment_submit",
        { ...paymentPayload, memberId: "b", transactionId: "NEWREF123" },
        memberAuth,
        now,
      ),
    /own payments/,
  );
});
test("rejected and voided payments cannot silently recredit; verified amounts immutable", () => {
  const d = paymentFixture();
  applyAction(d, "payment_submit", paymentPayload, memberAuth, now);
  applyAction(
    d,
    "payment_review",
    {
      id: d.payments![0].id,
      status: "approved",
      reviewNote: "Matched",
      verified: "on",
    },
    auth,
    now,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "deposit",
        {
          id: d.deposits[0].id,
          memberId: "a",
          date: "2026-09-20",
          amount: "500",
          note: "changed",
          reason: "change",
        },
        auth,
        now,
      ),
    /cannot be edited/,
  );
  applyAction(
    d,
    "void_deposit",
    { id: d.deposits[0].id, reason: "Incorrect verification" },
    auth,
    now,
  );
  assert.equal(d.payments![0].status, "voided");
  assert.equal(reconcile(d, "2026-09").deposits, 0);
  applyAction(
    d,
    "payment_submit",
    { ...paymentPayload, transactionId: "REJECT123" },
    memberAuth,
    now,
  );
  applyAction(
    d,
    "payment_review",
    { id: d.payments![1].id, status: "rejected", reviewNote: "Not received" },
    auth,
    now,
  );
  assert.equal(d.deposits.length, 1);
});
test("unverified payments block month close and preserve account destination snapshot", () => {
  const d = paymentFixture();
  applyAction(
    d,
    "payment_submit",
    { ...paymentPayload, date: "2026-08-20" },
    memberAuth,
    now,
  );
  applyAction(
    d,
    "payment_account",
    {
      provider: "bKash",
      number: "01711111111",
      name: "New account",
      instructions: "Send Money",
      enabled: "yes",
    },
    auth,
    now,
  );
  assert.equal(d.payments![0].recipient, "01700000000");
  assert.throws(
    () => applyAction(d, "close", { month: "2026-08" }, auth, now),
    /pending payments/,
  );
});
function menuPayload(d = "2026-09-22") {
  return {
    date: d,
    breakfastEnabled: "yes",
    breakfastMenu: "Egg and bread",
    breakfastCutoff: "07:00",
    lunchEnabled: "yes",
    lunchMenu: "Rice and fish",
    lunchCutoff: "10:00",
    dinnerEnabled: "no",
    dinnerCutoff: "16:00",
  };
}
test("menu availability and slot-specific Bangladesh deadlines are enforced", () => {
  const d = fixture();
  applyAction(d, "menu", menuPayload(), auth, now);
  assert.throws(
    () => applyAction(d, "menu", menuPayload(), memberAuth, now),
    /manager/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "meal",
        {
          memberId: "a",
          date: "2026-09-22",
          breakfast: 0,
          lunch: 0,
          dinner: 1,
        },
        memberAuth,
        now,
      ),
    /not served/,
  );
  const morning = new Date("2026-09-22T02:00:00Z"); // 08:00 Bangladesh.
  assert.throws(
    () =>
      applyAction(
        d,
        "meal",
        {
          memberId: "a",
          date: "2026-09-22",
          breakfast: 1,
          lunch: 0,
          dinner: 0,
        },
        memberAuth,
        morning,
      ),
    /closed at 07:00/,
  );
  applyAction(
    d,
    "meal",
    { memberId: "a", date: "2026-09-22", breakfast: 0, lunch: 1, dinner: 0 },
    memberAuth,
    morning,
  );
  assert.equal(d.meals[0].lunch, 1);
  assert.throws(
    () =>
      applyAction(
        d,
        "menu",
        { ...menuPayload(), lunchEnabled: "no" },
        auth,
        morning,
      ),
    /Existing lunch bookings/,
  );
});
test("date-range meal updates are atomic and cannot alter other members", () => {
  const d = fixture();
  applyAction(d, "menu", menuPayload(), auth, now);
  const request = {
    memberId: "a",
    start: "2026-09-22",
    end: "2026-09-24",
    breakfast: 1,
    lunch: 1,
    dinner: 0,
  };
  applyAction(d, "meal_range", request, memberAuth, now);
  assert.equal(d.meals.length, 3);
  const snapshot = JSON.stringify(d);
  assert.throws(
    () =>
      applyAction(
        d,
        "meal_range",
        { ...request, memberId: "b" },
        memberAuth,
        now,
      ),
    /own meals/,
  );
  assert.equal(JSON.stringify(d), snapshot);
  applyAction(
    d,
    "menu",
    { ...menuPayload("2026-09-25"), lunchEnabled: "no" },
    auth,
    now,
  );
  const before = JSON.stringify(d);
  assert.throws(
    () =>
      applyAction(
        d,
        "meal_range",
        { ...request, end: "2026-09-25" },
        memberAuth,
        now,
      ),
    /not served/,
  );
  assert.equal(JSON.stringify(d), before);
});
function fixture() {
  const d = emptyLedger();
  d.members = [
    { id: "a", name: "A", email: "a@example.com", joined: "2026-08-01" },
    { id: "b", name: "B", email: "b@example.com", joined: "2026-08-01" },
  ];
  return d;
}
test("rounding always preserves every paisa", () => {
  for (let total = 0; total < 1000; total++) {
    const a = allocate(total, [1, 2, 4]);
    assert.equal(
      a.reduce((s, n) => s + n, 0),
      total,
    );
    assert.ok(a.every(Number.isInteger));
  }
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
});
test("personal purchases are credited once, not charged to cash", () => {
  const d = fixture();
  d.meals = [
    {
      id: "a1",
      memberId: "a",
      date: "2026-08-01",
      breakfast: 1,
      lunch: 1,
      dinner: 0,
    },
    {
      id: "b1",
      memberId: "b",
      date: "2026-08-01",
      breakfast: 0,
      lunch: 1,
      dinner: 0,
    },
  ];
  d.expenses = [
    {
      id: "1",
      date: "2026-08-01",
      title: "Food",
      amount: 30000,
      category: "food",
      paidBy: "a",
      source: "personal",
      status: "approved",
    },
    {
      id: "2",
      date: "2026-08-01",
      title: "Power",
      amount: 10000,
      category: "utilities",
      paidBy: "a",
      source: "fund",
      status: "approved",
    },
  ];
  d.deposits = [
    { id: "1", date: "2026-08-01", memberId: "b", amount: 20000, note: "Paid" },
  ];
  const s = reconcile(d, "2026-08");
  assert.equal(s.cash, 10000);
  assert.equal(s.rows[0].due, -5000);
  assert.equal(s.rows[1].due, -5000);
  assert.equal(
    s.rows.reduce((n, r) => n + r.due, 0),
    -s.cash,
  );
});
test("pending costs do not change bills; finalization requires their review", () => {
  const d = fixture();
  applyAction(
    d,
    "expense",
    {
      date: "2026-08-10",
      title: "Rice",
      amount: "100",
      category: "food",
      source: "fund",
      paidBy: "a",
    },
    auth,
    now,
  );
  assert.equal(reconcile(d, "2026-08").food, 0);
  assert.throws(
    () => applyAction(d, "close", { month: "2026-08" }, auth, now),
    /pending/,
  );
});
test("meals upsert rather than double count, and history preserves correction", () => {
  const d = fixture();
  const p = {
    memberId: "a",
    date: "2026-08-10",
    breakfast: "1",
    lunch: "1",
    dinner: "1",
  };
  applyAction(d, "meal", p, auth, now);
  applyAction(d, "meal", { ...p, dinner: "0" }, auth, now);
  assert.equal(d.meals.length, 1);
  assert.equal(reconcile(d, "2026-08").totalMeals, 2);
  assert.match(d.history[1].action, /1\/1\/1 → 1\/1\/0/);
});
test("members cannot alter another member or deposits", () => {
  const d = fixture(),
    memberAuth = { ...auth, manager: false, memberId: "a" };
  assert.throws(
    () =>
      applyAction(
        d,
        "meal",
        {
          memberId: "b",
          date: "2026-09-22",
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        },
        memberAuth,
        now,
      ),
    /own meals/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "deposit",
        { memberId: "a", date: "2026-09-20", amount: 100, note: "Cash" },
        memberAuth,
        now,
      ),
    /manager/,
  );
});
test("meal deadline is enforced in Bangladesh time", () => {
  const d = fixture();
  assert.throws(
    () =>
      applyAction(
        d,
        "meal",
        {
          memberId: "a",
          date: "2026-09-21",
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        },
        { ...auth, manager: false, memberId: "a" },
        now,
      ),
    /10:00 AM/,
  );
});
test("closed months reject changes and retroactive new members", () => {
  const d = fixture();
  applyAction(d, "close", { month: "2026-08" }, auth, now);
  assert.throws(
    () =>
      applyAction(
        d,
        "meal",
        {
          memberId: "a",
          date: "2026-08-10",
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        },
        auth,
        now,
      ),
    /finalized/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "member",
        { name: "C", email: "c@example.com", joined: "2026-08-20" },
        auth,
        now,
      ),
    /finalized/,
  );
  assert.throws(
    () => applyAction(d, "close", { month: "2026-09" }, auth, now),
    /ended/,
  );
});
test("invalid amounts and impossible dates are rejected", () => {
  for (const amount of ["-1", "0", "1.001", "NaN", "1e5"]) {
    const d = fixture();
    assert.throws(() =>
      applyAction(
        d,
        "deposit",
        { memberId: "a", date: "2026-08-02", amount, note: "Cash" },
        auth,
        now,
      ),
    );
  }
  assert.throws(
    () =>
      applyAction(
        fixture(),
        "meal",
        {
          memberId: "a",
          date: "2026-02-30",
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        },
        auth,
        now,
      ),
    /valid date/,
  );
});
test("zero meals cannot allocate food or finalize, questions require resolution", () => {
  const d = fixture();
  applyAction(
    d,
    "expense",
    {
      date: "2026-08-10",
      title: "Rice",
      amount: "100",
      category: "food",
      source: "fund",
      paidBy: "a",
    },
    auth,
    now,
  );
  const id = d.expenses[0].id;
  applyAction(
    d,
    "review",
    { id, status: "approved", resolution: "Receipt verified" },
    auth,
    now,
  );
  assert.throws(
    () => applyAction(d, "close", { month: "2026-08" }, auth, now),
    /Log meals/,
  );
  applyAction(
    d,
    "meal",
    { memberId: "a", date: "2026-08-10", breakfast: 1, lunch: 1, dinner: 1 },
    auth,
    now,
  );
  applyAction(d, "question", { id, question: "Quantity?" }, auth, now);
  assert.throws(
    () => applyAction(d, "close", { month: "2026-08" }, auth, now),
    /questions/,
  );
  applyAction(
    d,
    "review",
    { id, status: "approved", resolution: "2 kg confirmed" },
    auth,
    now,
  );
  applyAction(d, "close", { month: "2026-08" }, auth, now);
  assert.equal(d.closed["2026-08"].rows[0].food, 10000);
});
test("deposit corrections preserve history and voids remove money from totals", () => {
  const d = fixture();
  applyAction(
    d,
    "deposit",
    { memberId: "a", date: "2026-08-10", amount: "100", note: "Cash" },
    auth,
    now,
  );
  const id = d.deposits[0].id;
  applyAction(
    d,
    "deposit",
    {
      id,
      memberId: "b",
      date: "2026-08-11",
      amount: "200",
      note: "Bank",
      reason: "Wrong member and amount",
    },
    auth,
    now,
  );
  assert.equal(d.deposits.length, 1);
  assert.equal(reconcile(d, "2026-08").rows[1].deposit, 20000);
  assert.match(d.history.at(-1)!.action, /10000.*20000/);
  applyAction(
    d,
    "void_deposit",
    { id, reason: "Duplicate bank entry" },
    auth,
    now,
  );
  assert.equal(reconcile(d, "2026-08").deposits, 0);
  assert.equal(d.deposits.length, 1);
  assert.throws(
    () =>
      applyAction(
        d,
        "deposit",
        {
          id,
          memberId: "b",
          date: "2026-08-11",
          amount: "300",
          note: "Bank",
          reason: "Retry",
        },
        auth,
        now,
      ),
    /voided/,
  );
});
test("closed deposits cannot be moved to another month or voided", () => {
  const d = fixture();
  applyAction(
    d,
    "deposit",
    { memberId: "a", date: "2026-08-10", amount: "100", note: "Cash" },
    auth,
    now,
  );
  const id = d.deposits[0].id;
  applyAction(d, "close", { month: "2026-08" }, auth, now);
  assert.throws(
    () =>
      applyAction(
        d,
        "deposit",
        {
          id,
          memberId: "a",
          date: "2026-09-10",
          amount: "100",
          note: "Cash",
          reason: "Move",
        },
        auth,
        now,
      ),
    /finalized/,
  );
  assert.throws(
    () => applyAction(d, "void_deposit", { id, reason: "Remove" }, auth, now),
    /finalized/,
  );
});
test("member details require a manager and cannot duplicate another email", () => {
  const d = fixture();
  assert.throws(
    () =>
      applyAction(
        d,
        "member_edit",
        { id: "a", name: "A", email: "new@example.com" },
        { ...auth, manager: false },
        now,
      ),
    /manager/,
  );
  assert.throws(
    () =>
      applyAction(
        d,
        "member_edit",
        { id: "a", name: "A", email: "b@example.com" },
        auth,
        now,
      ),
    /already/,
  );
  applyAction(
    d,
    "member_edit",
    { id: "a", name: "New A", email: "new@example.com" },
    auth,
    now,
  );
  assert.equal(d.members[0].email, "new@example.com");
  assert.equal(d.members[0].id, "a");
});
