import mongoose from "mongoose";
import { put, list, del } from "@vercel/blob";
import { capture, seal } from "./backup.ts";
import { dispatchNotifications } from "./notifications.ts";

// Daily encrypted backups; retain at least the last 30 days. Never touch receipts.
export async function runBackup() {
  if (!process.env.BACKUP_KEY || !process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Backup service is not configured");
  const archive = await capture(mongoose.connection);
  const pathname = `backups/messmate-${new Date().toISOString().replaceAll(":", "-")}.mmbak`;
  await put(pathname, seal(archive, process.env.BACKUP_KEY), { access: "private", addRandomSuffix: false, contentType: "application/octet-stream" });
  const cutoff = Date.now() - 30 * 86400000;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "backups/messmate-", limit: 100, cursor });
    const expired = page.blobs.filter(x => x.pathname.endsWith(".mmbak") && x.uploadedAt.getTime() < cutoff).map(x => x.url);
    if (expired.length) await del(expired);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  await dispatchNotifications();
  return { saved: true, at: archive.at, counts: Object.fromEntries(Object.entries(archive.collections).map(([n, c]) => [n, c.count])), receipts: archive.files.length };
}
