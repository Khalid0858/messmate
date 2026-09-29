import mongoose from "mongoose";
import { list } from "@vercel/blob";
import { Mess } from "./models.ts";
export async function operationalStatus() {
  const rows = await Mess.aggregate([
    { $project: { bytes: { $bsonSize: "$$ROOT" }, outbox: "$data.outbox" } },
  ]);
  let queued = 0,
    uncertain = 0,
    oldest = 0,
    maxLedgerBytes = 0;
  for (const r of rows) {
    maxLedgerBytes = Math.max(maxLedgerBytes, r.bytes);
    for (const e of r.outbox || []) {
      if (e.status === "queued") {
        queued++;
        oldest = Math.max(oldest, Date.now() - Date.parse(e.at));
      }
      if (["unknown", "sending"].includes(e.status) && !e.resolvedAt)
        uncertain++;
    }
  }
  let cursor: string | undefined,
    latest = 0,
    blobBytes = 0;
  do {
    const page = await list({
      prefix: "backups/messmate-",
      limit: 100,
      cursor,
    });
    for (const b of page.blobs) {
      latest = Math.max(latest, b.uploadedAt.getTime());
      blobBytes += b.size;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const backupAgeHours = latest ? (Date.now() - latest) / 3600000 : null;
  const database = mongoose.connection.readyState === 1;
  const ok =
    database &&
    backupAgeHours !== null &&
    backupAgeHours < 30 &&
    oldest < 3600000 &&
    uncertain === 0 &&
    maxLedgerBytes < 7000000;
  return {
    ok,
    database,
    queued,
    uncertain,
    oldestQueuedMinutes: Math.round(oldest / 60000),
    backupAgeHours:
      backupAgeHours === null ? null : Math.round(backupAgeHours * 10) / 10,
    maxLedgerBytes,
    backupBytes: blobBytes,
  };
}
