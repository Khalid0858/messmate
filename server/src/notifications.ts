import { Mess, User } from "./models.ts";
import { sendSms, smsReady, sendMail, mailReady } from "./providers.ts";
// Outbox is committed with the deposit. A send is claimed once; an ambiguous network
// failure is marked unknown, never automatically resent (SMS APIs cannot promise exactly once).
export async function dispatchNotifications(messId?: string, services = { sendSms, smsReady, sendMail, mailReady }) {
  if (!services.smsReady() && !services.mailReady()) return;
  const channelFilter = services.mailReady() && services.smsReady() ? {} :
    services.mailReady() ? { channel: "email" } : { channel: { $ne: "email" } };
  const candidates = await Mess.find({
    "data.outbox": { $elemMatch: { status: "queued", ...channelFilter } },
    ...(messId ? { _id: messId } : {}),
  }).limit(messId ? 1 : 3);
  for (const m of candidates) {
    const e = m.data.outbox.find((x: any) => x.status === "queued" && (x.channel === "email" ? services.mailReady() : services.smsReady()));
    if (!e) continue;
    const member = m.data.members.find((x: any) => x.id === e.memberId),
      user = member?.userId ? await User.findById(member.userId) : null;
    const index = m.data.outbox.findIndex((x: any) => x.id === e.id);
    const prefix = `data.outbox.${index}`;
    const result = await Mess.updateOne(
      { _id: m._id, revision: m.revision, [`${prefix}.status`]: "queued" },
      {
        $set: {
          [`${prefix}.status`]: "sending",
          [`${prefix}.claimedAt`]: new Date().toISOString(),
        },
        $inc: { revision: 1 },
      },
    );
    if (!result.modifiedCount) continue;
    let status = "not_enabled",
      providerId = "";
    if (e.channel === "email" && user?.verified) {
      try {
        providerId = (await services.sendMail(user.email, "MessMate — Deposit update", `${e.message}\n\nSign in to your private MessMate account to review the details. This is a record notification, not a money transfer.`)) || "";
        status = "accepted";
      } catch { status = "unknown"; }
    } else if (e.channel !== "email" && user?.phone && user.smsConsent) {
      try {
        providerId = await services.sendSms(user.phone, e.message);
        status = "accepted";
      } catch {
        status = "unknown";
      }
    }
    await Mess.updateOne(
      { _id: m._id, "data.outbox.id": e.id },
      {
        $set: {
          "data.outbox.$.status": status,
          "data.outbox.$.providerId": providerId,
        },
        $inc: { revision: 1 },
      },
    );
  }
}
