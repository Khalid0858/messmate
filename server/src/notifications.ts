import { Mess, User } from "./models.ts";
import { sendSms, smsReady } from "./providers.ts";
// Outbox is committed with the deposit. A send is claimed once; an ambiguous network
// failure is marked unknown, never automatically resent (SMS APIs cannot promise exactly once).
export async function dispatchNotifications(messId?: string) {
  if (!smsReady()) return;
  const candidates = await Mess.find({
    "data.outbox.status": "queued",
    ...(messId ? { _id: messId } : {}),
  }).limit(messId ? 1 : 3);
  for (const m of candidates) {
    const e = m.data.outbox.find((x: any) => x.status === "queued");
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
    if (user?.phone && user.smsConsent) {
      try {
        providerId = await sendSms(user.phone, e.message);
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
