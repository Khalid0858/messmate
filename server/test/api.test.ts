import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { connect, Mess } from "../src/models.ts";
import { createApp } from "../src/app.ts";
import { dispatchNotifications } from "../src/notifications.ts";
let db: MongoMemoryReplSet;
const inbox: Record<string, string> = {};
const origin = "http://localhost:5180";
const receiptObjects = new Map<string, Buffer>();
const app = createApp({
  origin,
  mailReady: () => true,
  files: {
    put: async (key, bytes) => {
      receiptObjects.set(key, bytes);
    },
    get: async (key) => ({
      Body: {
        transformToByteArray: async () =>
          new Uint8Array(receiptObjects.get(key)!),
      },
    }),
  },
  mailer: async (to, _subject, message) => {
    inbox[to] = message;
  },
});
before(
  async () => {
    db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await connect(db.getUri());
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
async function signup(email: string, returnTo = "/app/overview") {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "Test Member", email, password: "Test-password-123!", returnTo })
    .expect(202);
  assert.equal(
    new URL(inbox[email].split("\n")[0]).searchParams.get("returnTo"),
    returnTo.startsWith("/app/") ? returnTo : "/app/overview",
  );
  const token = new URL(inbox[email].split("\n")[0]).searchParams.get("token");
  await agent
    .post("/api/auth/verify")
    .set("Origin", origin)
    .send({ token })
    .expect(200);
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password: "Test-password-123!" })
    .expect(200);
  return { agent, csrf: login.body.csrf };
}
test("registration, invitation, isolation, CSRF, concurrent approval, durable retries and reset", async () => {
  assert.equal(
    (await request(app).get("/api/auth/availability").expect(200)).body
      .registration,
    true,
  );
  const unavailable = createApp({ origin, mailReady: () => false });
  assert.equal(
    (await request(unavailable).get("/api/auth/availability").expect(200)).body
      .registration,
    false,
  );
  await request(unavailable)
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Unavailable",
      email: "unavailable@example.test",
      password: "Test-password-123!",
    })
    .expect(503);
  const owner = await signup(
      "owner@example.test",
      "/app/deposits?month=2026-09",
    ),
    member = await signup("member@example.test"),
    other = await signup(
      "outsider@example.test",
      "https://example.invalid/steal",
    );
  const post = (who: typeof owner, url: string, p: any) =>
    who.agent
      .post(url)
      .set("Origin", origin)
      .set("x-csrf-token", who.csrf)
      .send(p);
  process.env.SUPPORT_EMAIL = "support@example.test";
  await request(app)
    .post("/api/support")
    .set("Origin", origin)
    .send({
      email: "owner@example.test",
      subject: "Account help",
      message: "I need help understanding my settings.",
    })
    .expect(202);
  assert(inbox["support@example.test"].includes("Account help"));
  delete process.env.SUPPORT_EMAIL;
  const created = await post(owner, "/api/messes", {
      name: "Integration mess",
    }).expect(201),
    id = created.body.id;
  await other.agent.get(`/api/messes/${id}`).expect(404);
  const receipt = Buffer.from("%PDF-1.7 fictional receipt");
  const savedReceipt = await owner.agent
    .post(`/api/messes/${id}/files`)
    .set("Origin", origin)
    .set("x-csrf-token", owner.csrf)
    .attach("file", receipt, {
      filename: "receipt.pdf",
      contentType: "application/pdf",
    })
    .expect(201);
  const receiptUrl = `/api/messes/${id}/files/${savedReceipt.body.key.split("/")[1]}`;
  const downloaded = await owner.agent.get(receiptUrl).expect(200);
  assert.deepEqual(downloaded.body, receipt);
  assert.equal(downloaded.headers["cache-control"], "private, no-store");
  await other.agent.get(receiptUrl).expect(404);
  await request(app).get(receiptUrl).expect(401);
  await owner.agent
    .post(`/api/messes/${id}/files`)
    .set("Origin", origin)
    .set("x-csrf-token", owner.csrf)
    .attach("file", Buffer.from("wrong type"), {
      filename: "fake.png",
      contentType: "image/png",
    })
    .expect(400);
  await owner.agent
    .post("/api/messes")
    .set("Origin", origin)
    .send({ name: "Missing csrf" })
    .expect(403);
  const invite = await post(owner, `/api/messes/${id}/invites`, {
      email: "member@example.test",
    }).expect(200),
    url = new URL(invite.body.url),
    payload = { mess: id, token: url.searchParams.get("token") };
  await post(other, "/api/invites/accept", payload).expect(400);
  await post(member, "/api/invites/accept", payload).expect(200);
  await post(member, "/api/invites/accept", payload).expect(400);
  let state = (await owner.agent.get(`/api/messes/${id}`)).body;
  const act = (
    who: typeof owner,
    action: string,
    payload: any,
    revision = state.revision,
    requestId = randomUUID(),
  ) =>
    post(who, `/api/messes/${id}/actions`, {
      action,
      payload,
      revision,
      requestId,
    });
  const memberId = state.data.members[1].id;
  await act(member, "manager", { month: "2026-09", memberId }).expect(403);
  state = (
    await act(owner, "account", {
      provider: "bKash",
      number: "01700000000",
      name: "Manager",
      instructions: "Send Money",
      enabled: true,
    }).expect(200)
  ).body;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(new Date());
  state = (
    await act(member, "deposit_submit", {
      memberId,
      date,
      amount: "100",
      provider: "bKash",
      transactionId: "ABC123XYZ",
    }).expect(200)
  ).body;
  const approval = {
      id: state.data.deposits[0].id,
      status: "approved",
      verified: true,
      reason: "Matched wallet",
    },
    key = randomUUID(),
    revision = state.revision;
  const results = await Promise.all([
    act(owner, "deposit_review", approval, revision, key),
    act(owner, "deposit_review", approval, revision, key),
  ]);
  assert(results.every((r) => [200, 409].includes(r.status)));
  assert(results.some((r) => r.status === 200));
  await act(owner, "deposit_review", approval, revision, key).expect(200);
  const stored = await Mess.findById(id);
  assert.equal(stored.data.deposits.length, 1);
  assert.equal(stored.data.deposits[0].status, "approved");
  assert.equal(stored.data.outbox.length, 1);
  assert.equal(stored.data.outbox[0].channel, "email");
  let emailSends = 0;
  const notificationService = {
    mailReady: () => true,
    smsReady: () => false,
    sendMail: async (to: string) => {
      assert.equal(to, "member@example.test");
      emailSends++;
      return "fixture-email-id";
    },
    sendSms: async () => {
      throw new Error("SMS must remain disabled");
    },
  };
  await Promise.all([
    dispatchNotifications(id, notificationService),
    dispatchNotifications(id, notificationService),
  ]);
  await dispatchNotifications(id, notificationService);
  assert.equal(emailSends, 1);
  assert.equal((await Mess.findById(id)).data.outbox[0].status, "accepted");
  const uncertain = {
    ...stored.data.outbox[0],
    id: randomUUID(),
    status: "queued",
  };
  await Mess.updateOne(
    { _id: id },
    { $push: { "data.outbox": uncertain }, $inc: { revision: 1 } },
  );
  let attempts = 0;
  const failing = {
    ...notificationService,
    sendMail: async () => {
      attempts++;
      throw new Error("Ambiguous provider timeout");
    },
  };
  await dispatchNotifications(id, failing);
  await dispatchNotifications(id, failing);
  assert.equal(attempts, 1);
  assert.equal(
    (await Mess.findById(id)).data.outbox.find(
      (x: any) => x.id === uncertain.id,
    ).status,
    "unknown",
  );
  // Batch processing drains multiple queued events; stale claims become unknown without resend.
  const batch = Array.from({ length: 3 }, () => ({
    ...uncertain,
    id: randomUUID(),
    status: "queued",
    attempts: 0,
  }));
  const stale = {
    ...uncertain,
    id: randomUUID(),
    status: "sending",
    claimedAt: new Date(Date.now() - 11 * 60000).toISOString(),
  };
  await Mess.updateOne(
    { _id: id },
    {
      $push: { "data.outbox": { $each: [...batch, stale] } },
      $inc: { revision: 1 },
    },
  );
  const drained = await dispatchNotifications(id, notificationService, {
    maxMessages: 8,
    budgetMs: 45000,
  });
  assert.equal(drained.accepted, 3);
  assert.equal(
    (await Mess.findById(id)).data.outbox.find((x: any) => x.id === stale.id)
      .status,
    "unknown",
  );
  const ownerView = (await owner.agent.get("/api/messes/" + id)).body;
  assert.equal(ownerView.adminId, ownerView.data.members[0].userId);
  await post(member, "/api/messes/" + id + "/invites/revoke", {
    email: "pending@example.test",
  }).expect(403);
  const pendingInvite = await post(owner, "/api/messes/" + id + "/invites", {
    email: "pending@example.test",
  }).expect(200);
  const ownerPending = (await owner.agent.get("/api/messes/" + id)).body.data
    .invites;
  assert(ownerPending.some((x: any) => x.email === "pending@example.test"));
  assert(ownerPending.every((x: any) => !x.token));
  assert.equal(
    (await member.agent.get("/api/messes/" + id)).body.data.invites.length,
    0,
  );
  await post(owner, "/api/messes/" + id + "/invites/revoke", {
    email: "pending@example.test",
  }).expect(200);
  assert.equal(
    (await owner.agent.get("/api/messes/" + id)).body.data.invites.length,
    0,
  );
  state = (await owner.agent.get("/api/messes/" + id)).body;
  await act(member, "notification_reconcile", {
    id: stale.id,
    reason: "Not permitted",
  }).expect(403);
  state = (
    await act(owner, "notification_reconcile", {
      id: stale.id,
      reason: "Provider log checked; no resend requested",
    }).expect(200)
  ).body;
  assert.equal(
    state.data.outbox.find((x: any) => x.id === stale.id).status,
    "unknown",
  );
  assert(state.data.outbox.find((x: any) => x.id === stale.id).resolvedAt);
  state = (await act(member, "read_all_notifications", {}).expect(200)).body;
  assert(state.data.notifications.every((x: any) => x.read));
  const report = await owner.agent
    .get(`/api/messes/${id}/settlement/${date.slice(0, 7)}`)
    .expect(200);
  assert.equal(report.body.cash, 10000);
  await owner.agent
    .post("/api/auth/forgot")
    .set("Origin", origin)
    .send({ email: "owner@example.test" })
    .expect(202);
  const resetToken = new URL(
    inbox["owner@example.test"].split("\n")[0],
  ).searchParams.get("token");
  await owner.agent
    .post("/api/auth/reset")
    .set("Origin", origin)
    .send({ token: resetToken, password: "New-password-123!" })
    .expect(200);
  await owner.agent.get("/api/me").expect(401);
  await owner.agent
    .post("/api/auth/reset")
    .set("Origin", origin)
    .send({ token: resetToken, password: "New-password-123!" })
    .expect(400);
});
