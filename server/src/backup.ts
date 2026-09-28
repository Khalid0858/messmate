import mongoose from "mongoose";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { getFile } from "./providers.ts";

const names = ["users", "messes", "uploads"] as const;
const hash = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const EJSON = mongoose.mongo.BSON.EJSON;
type Archive = { version: 1; at: string; collections: Record<string, { documents: string; count: number; sha256: string; indexes: any[] }>; files: { key: string; contentType: string; bytes: string; sha256: string }[] };
function key(raw: string) {
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) throw new Error("BACKUP_KEY must be 32 random bytes encoded as base64");
  return bytes;
}
export function seal(archive: Archive, secret: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(JSON.stringify(archive))), cipher.final()]);
  return Buffer.concat([Buffer.from("MMBK1"), iv, cipher.getAuthTag(), encrypted]);
}
export function unseal(bytes: Buffer, secret: string): Archive {
  if (bytes.subarray(0, 5).toString() !== "MMBK1") throw new Error("Invalid backup format");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(5, 17));
  decipher.setAuthTag(bytes.subarray(17, 33));
  const archive = JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(33)), decipher.final()]), { maxOutputLength: 128 * 1024 * 1024 }).toString()) as Archive;
  if (archive.version !== 1 || Object.keys(archive.collections).sort().join() !== [...names].sort().join()) throw new Error("Unsupported backup schema");
  for (const item of Object.values(archive.collections)) {
    if (hash(item.documents) !== item.sha256 || EJSON.parse(item.documents).length !== item.count) throw new Error("Collection checksum/count mismatch");
  }
  for (const f of archive.files) if (hash(Buffer.from(f.bytes, "base64")) !== f.sha256) throw new Error("Receipt checksum mismatch");
  return archive;
}
export async function capture(connection: mongoose.Connection, readFile = getFile): Promise<Archive> {
  if (!connection.db) throw new Error("Database not connected");
  const archive: Archive = { version: 1, at: new Date().toISOString(), collections: {}, files: [] };
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of names) {
        const collection = connection.db!.collection(name);
        const documents = await collection.find({}, { session }).sort({ _id: 1 }).toArray();
        const serialized = EJSON.stringify(documents, { relaxed: false });
        if (Buffer.byteLength(serialized) > 64 * 1024 * 1024) throw new Error("Use streaming mongodump for databases over 64 MB per collection");
        archive.collections[name] = { documents: serialized, count: documents.length, sha256: hash(serialized), indexes: await collection.indexes() };
      }
    }, { readConcern: { level: "snapshot" } });
  } finally { await session.endSession(); }
  let total = 0;
  for (const upload of EJSON.parse(archive.collections.uploads.documents)) {
    const object = await readFile(upload.key);
    const bytes = Buffer.from(await object.Body!.transformToByteArray());
    total += bytes.length;
    if (total > 48 * 1024 * 1024) throw new Error("Use streaming object backup for receipts over 48 MB");
    if (bytes.length !== upload.size) throw new Error("Receipt metadata size mismatch");
    archive.files.push({ key: upload.key, contentType: upload.contentType, bytes: bytes.toString("base64"), sha256: hash(bytes) });
  }
  return archive;
}
// Restore to an EMPTY, isolated database only. Never drop or overwrite production.
// Sessions, reset tickets and rate counters are intentionally not restored.
export async function restore(archive: Archive, target: mongoose.Connection, writeFile: (key: string, bytes: Buffer, contentType: string) => Promise<void>) {
  if (!target.db) throw new Error("Target database not connected");
  const existing = await target.db.listCollections().toArray();
  for (const collection of existing) {
    if (!collection.name.startsWith("system.") && await target.db.collection(collection.name).countDocuments()) throw new Error("Restore target must be empty");
  }
  for (const file of archive.files) await writeFile(file.key, Buffer.from(file.bytes, "base64"), file.contentType);
  for (const name of names) {
    const item = archive.collections[name], collection = target.db.collection(name), documents = EJSON.parse(item.documents);
    if (documents.length) await collection.insertMany(documents);
    for (const { v, ns, ...index } of item.indexes) if (index.name !== "_id_") await collection.createIndexes([index]);
    const rows = await collection.find().sort({ _id: 1 }).toArray();
    if (rows.length !== item.count || hash(EJSON.stringify(rows, { relaxed: false })) !== item.sha256) throw new Error("Restored database did not reconcile");
  }
  return { collections: Object.fromEntries(names.map(n => [n, archive.collections[n].count])), receipts: archive.files.length, reconciled: true };
}
