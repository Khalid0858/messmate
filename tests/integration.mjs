import assert from "node:assert/strict";

// This suite targets the built Worker on loopback only. It supplies synthetic
// identity headers because the Sites authentication proxy is absent locally.
const origin = process.env.MESSMATE_TEST_ORIGIN || "http://127.0.0.1:5175";
const url = new URL(origin);
assert.ok(
  ["127.0.0.1", "localhost"].includes(url.hostname),
  "Integration tests are local-only.",
);
const run = crypto.randomUUID();
const identities = {
  owner: { id: "qa-owner-" + run, email: "owner-" + run + "@example.com" },
  member: { id: "qa-member-" + run, email: "member-" + run + "@example.com" },
  outsider: {
    id: "qa-outsider-" + run,
    email: "outsider-" + run + "@example.com",
  },
};
let checks = 0;
const headers = (who) => ({
  "oai-authenticated-user-id": identities[who].id,
  "oai-authenticated-user-email": identities[who].email,
  Origin: origin,
});
async function request(path, who, options = {}, status = 200) {
  const r = await fetch(origin + path, {
    ...options,
    headers: { ...(who ? headers(who) : {}), ...options.headers },
  });
  const j = await r.json();
  assert.equal(r.status, status, JSON.stringify(j));
  checks++;
  return j;
}
const get = (who, household) =>
  request("/api/ledger" + (household ? "?household=" + household : ""), who);
let state = await get("owner");
const household = state.householdId;
async function save(
  action,
  payload,
  who = "owner",
  expected = 200,
  version = state.version,
) {
  const j = await request(
    "/api/ledger",
    who,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId: household,
        version,
        action,
        payload,
      }),
    },
    expected,
  );
  if (expected === 200) state = { ...state, ...j };
  return j;
}
await request("/api/ledger", null, {}, 401);
await request(
  "/api/ledger",
  "owner",
  {
    method: "POST",
    headers: {
      Origin: "https://wrong.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  },
  403,
);
await request("/api/ledger?household=" + household, "outsider", {}, 403);
await get("member"); // Already owns a separate empty mess before being invited.
await save("settings", { name: "Integration test " + run.slice(0, 8) });
await save(
  "settings",
  { name: "Stale overwrite" },
  "owner",
  409,
  state.version - 1,
);
await save("member", {
  name: "Manager",
  email: identities.owner.email,
  joined: "2020-01-01",
});
await save("member", {
  name: "Housemate",
  email: identities.member.email,
  joined: "2020-01-01",
});
const managerId = state.data.members[0].id,
  memberId = state.data.members[1].id;
const memberState = await get("member", household);
assert.equal(memberState.role, "member");
assert.equal(memberState.workspaces.length, 2);
checks++;
await save(
  "deposit",
  { memberId, date: "2026-08-01", amount: "50", note: "Not allowed" },
  "member",
  400,
);
await save(
  "member_edit",
  { id: managerId, name: "Changed", email: "bad@example.com" },
  "member",
  400,
);
const today = new Date(),
  previous = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
  );
const month = previous.toISOString().slice(0, 7),
  date = month + "-10";
await save("meal", {
  memberId: managerId,
  date,
  breakfast: 1,
  lunch: 1,
  dinner: 0,
});
await save("meal", { memberId, date, breakfast: 0, lunch: 1, dinner: 0 });
await save(
  "meal",
  { memberId: managerId, date, breakfast: 1, lunch: 1, dinner: 1 },
  "member",
  400,
);
await save(
  "meal",
  { memberId, date, breakfast: 1, lunch: 1, dinner: 1 },
  "member",
  400,
);
await save("deposit", { memberId, date, amount: "1000", note: "Bank receipt" });
const deposit = state.data.deposits.at(-1).id;
await save("deposit", {
  id: deposit,
  memberId,
  date,
  amount: "1200",
  note: "Correct receipt",
  reason: "Misread amount",
});
assert.equal(state.data.deposits.at(-1).amount, 120000);
checks++;
await save("deposit", { memberId, date, amount: "100", note: "Duplicate" });
await save("void_deposit", {
  id: state.data.deposits.at(-1).id,
  reason: "Duplicate record",
});
assert.equal(state.data.deposits.at(-1).voided, true);
checks++;
await save(
  "expense",
  {
    paidBy: memberId,
    date,
    amount: "300",
    title: "Rice",
    category: "food",
    source: "personal",
  },
  "member",
);
const expense = state.data.expenses.at(-1).id;
await save("close", { month }, "owner", 400);
await save("review", {
  id: expense,
  status: "approved",
  resolution: "Receipt checked",
});
await save(
  "question",
  { id: expense, question: "Confirm rice weight" },
  "member",
);
await save("close", { month }, "owner", 400);
await save("review", {
  id: expense,
  status: "approved",
  resolution: "Weight confirmed",
});
const form = new FormData();
form.set(
  "file",
  new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
  "receipt.pdf",
);
const uploaded = await request(
  "/api/receipt?household=" + household,
  "member",
  { method: "POST", body: form },
);
const file = await fetch(
  origin + "/api/receipt?key=" + encodeURIComponent(uploaded.key),
  { headers: headers("owner") },
);
assert.equal(file.status, 200);
assert.equal(file.headers.get("cache-control"), "private, no-store");
checks++;
await request(
  "/api/receipt?key=" + encodeURIComponent(uploaded.key),
  "outsider",
  {},
  403,
);
const invalid = new FormData();
invalid.set(
  "file",
  new Blob(["not a pdf"], { type: "application/pdf" }),
  "bad.pdf",
);
await request(
  "/api/receipt?household=" + household,
  "owner",
  { method: "POST", body: invalid },
  400,
);
await save("close", { month });
assert.equal(
  state.data.closed[month].rows.reduce((n, r) => n + r.food, 0),
  30000,
);
checks++;
await save(
  "deposit",
  {
    id: deposit,
    memberId,
    date,
    amount: "1500",
    note: "Change",
    reason: "Too late",
  },
  "owner",
  400,
);
await save("void_deposit", { id: deposit, reason: "Too late" }, "owner", 400);
await save(
  "meal",
  { memberId, date, breakfast: 0, lunch: 0, dinner: 0 },
  "owner",
  400,
);
const currentDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const nextDate = new Date(Date.parse(currentDate) + 86400000)
  .toISOString()
  .slice(0, 10);
const account = {
  provider: "bKash",
  number: "01700000000",
  name: "QA account",
  instructions: "Send Money",
  enabled: "yes",
};
await save("payment_account", account, "member", 400);
await save("payment_account", account);
const paymentPayload = {
  memberId,
  provider: "bKash",
  transactionId: "QA123456",
  sender: "01800000000",
  amount: "500.25",
  date: currentDate,
};
await save("payment_submit", paymentPayload, "member");
const paymentId = state.data.payments.at(-1).id;
assert.equal(state.data.payments.at(-1).status, "pending");
checks++;
await save("payment_submit", paymentPayload, "member", 400);
await save(
  "payment_review",
  { id: paymentId, status: "approved", reviewNote: "verified", verified: "on" },
  "member",
  400,
);
const reviewVersion = state.version;
// Two concurrent reviewers see the same version. Exactly one may commit.
const concurrent = await Promise.all(
  [1, 2].map(() =>
    fetch(origin + "/api/ledger", {
      method: "POST",
      headers: { ...headers("owner"), "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId: household,
        version: reviewVersion,
        action: "payment_review",
        payload: {
          id: paymentId,
          status: "approved",
          reviewNote: "Matched receiving account",
          verified: "on",
        },
      }),
    }),
  ),
);
assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
checks++;
state = await get("owner", household);
assert.equal(
  state.data.deposits.filter((d) => d.paymentId === paymentId).length,
  1,
);
checks++;
await save(
  "payment_review",
  { id: paymentId, status: "approved", reviewNote: "retry", verified: "on" },
  "owner",
  400,
);
await save("void_deposit", {
  id: state.data.payments.find((p) => p.id === paymentId).depositId,
  reason: "QA correction",
});
assert.equal(
  state.data.payments.find((p) => p.id === paymentId).status,
  "voided",
);
checks++;
const menu = {
  date: nextDate,
  breakfastEnabled: "yes",
  breakfastMenu: "Toast and eggs",
  breakfastCutoff: "07:00",
  lunchEnabled: "yes",
  lunchMenu: "Rice and fish",
  lunchCutoff: "10:00",
  dinnerEnabled: "no",
  dinnerCutoff: "16:00",
};
await save("menu", menu, "member", 400);
await save("menu", menu);
await save(
  "meal_range",
  {
    memberId,
    start: nextDate,
    end: nextDate,
    breakfast: 1,
    lunch: 1,
    dinner: 1,
  },
  "member",
  400,
);
await save(
  "meal_range",
  {
    memberId: managerId,
    start: nextDate,
    end: nextDate,
    breakfast: 1,
    lunch: 1,
    dinner: 0,
  },
  "member",
  400,
);
await save(
  "meal_range",
  {
    memberId,
    start: nextDate,
    end: nextDate,
    breakfast: 1,
    lunch: 1,
    dinner: 0,
  },
  "member",
);
await save("menu", { ...menu, lunchEnabled: "no" }, "owner", 400);
await save(
  "meal_range",
  {
    memberId,
    start: nextDate,
    end: nextDate,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
  },
  "member",
);
assert.equal(
  state.data.meals.find((m) => m.memberId === memberId && m.date === nextDate)
    .lunch,
  0,
);
checks++;
const reloaded = await get("owner");
assert.deepEqual(reloaded.data.closed, state.data.closed);
assert.equal(reloaded.version, state.version);
checks++;
console.log(
  `PASS: ${checks} integration assertions, including household isolation, membership switching, writes, corrections, uploads, concurrency and finalization.`,
);
