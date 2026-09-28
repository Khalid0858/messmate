import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { connect, Mess } from "../src/models.ts";
import { createApp } from "../src/app.ts";
let db: MongoMemoryReplSet;
const inbox: Record<string, string> = {};
const origin = "http://localhost:5180";
const app = createApp({
  origin,
  mailReady: () => true,
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
async function signup(email: string) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "Test Member", email, password: "Test-password-123!" })
    .expect(202);
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
  const owner = await signup("owner@example.test"),
    member = await signup("member@example.test"),
    other = await signup("outsider@example.test");
  const post = (who: typeof owner, url: string, p: any) =>
    who.agent
      .post(url)
      .set("Origin", origin)
      .set("x-csrf-token", who.csrf)
      .send(p);
  const created = await post(owner, "/api/messes", {
      name: "Integration mess",
    }).expect(201),
    id = created.body.id;
  await other.agent.get(`/api/messes/${id}`).expect(404);
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
