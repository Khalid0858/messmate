import { Mess, User } from "./models.ts";
import { sendSms, smsReady, sendMail, mailReady } from "./providers.ts";
// Atomic claim before external I/O. Ambiguous sends are never blindly retried.
export async function dispatchNotifications(
  messId?: string,
  services = { sendSms, smsReady, sendMail, mailReady },
  limits = { maxMessages: 8, budgetMs: 45000 },
) {
  const result = { claimed: 0, accepted: 0, unknown: 0 };
  if (!services.smsReady() && !services.mailReady()) return result;
  const scope = messId ? { _id: messId } : {};
  const stale = new Date(Date.now() - 10 * 60000).toISOString();
  await Mess.updateMany(
    {
      ...scope,
      "data.outbox": {
        $elemMatch: { status: "sending", claimedAt: { $lt: stale } },
      },
    },
    { $set: { "data.outbox.$[e].status": "unknown" }, $inc: { revision: 1 } },
    {
      arrayFilters: [{ "e.status": "sending", "e.claimedAt": { $lt: stale } }],
    },
  );
  const channel =
    services.mailReady() && services.smsReady()
      ? {}
      : services.mailReady()
        ? { channel: "email" }
        : { channel: { $ne: "email" } };
  const started = Date.now();
  for (let i = 0; i < limits.maxMessages; i++) {
    if (i && Date.now() - started > limits.budgetMs - 22000) break;
    const m = await Mess.findOne({
      ...scope,
      "data.outbox": { $elemMatch: { status: "queued", ...channel } },
    }).sort({ updatedAt: 1 });
    if (!m) break;
    const e = m.data.outbox.find(
      (x: any) =>
        x.status === "queued" &&
        (x.channel === "email" ? services.mailReady() : services.smsReady()),
    );
    if (!e) break;
    const index = m.data.outbox.findIndex((x: any) => x.id === e.id),
      prefix = "data.outbox." + index;
    const claim = await Mess.updateOne(
      { _id: m._id, revision: m.revision, [prefix + ".status"]: "queued" },
      {
        $set: {
          [prefix + ".status"]: "sending",
          [prefix + ".claimedAt"]: new Date().toISOString(),
        },
        $inc: { revision: 1, [prefix + ".attempts"]: 1 },
      },
    );
    if (!claim.modifiedCount) continue;
    result.claimed++;
    let status = "not_enabled",
      providerId = "";
    try {
      const member = m.data.members.find((x: any) => x.id === e.memberId),
        user = member?.userId ? await User.findById(member.userId) : null;
      if (e.channel === "email" && user?.verified) {
        providerId =
          (await services.sendMail(
            user.email,
            "MessMate — Deposit update",
            e.message +
              "\n\nReview your private account for details. This is a record notification, not a money transfer.",
          )) || "";
        status = "accepted";
      } else if (e.channel !== "email" && user?.phone && user.smsConsent) {
        providerId = await services.sendSms(user.phone, e.message);
        status = "accepted";
      }
    } catch {
      status = "unknown";
    }
    await Mess.updateOne(
      {
        _id: m._id,
        "data.outbox": { $elemMatch: { id: e.id, status: "sending" } },
      },
      {
        $set: {
          "data.outbox.$.status": status,
          "data.outbox.$.providerId": providerId,
          "data.outbox.$.completedAt": new Date().toISOString(),
        },
        $inc: { revision: 1 },
      },
    );
    if (status === "accepted") result.accepted++;
    if (status === "unknown") result.unknown++;
  }
  return result;
}
