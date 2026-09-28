import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { capture, seal, unseal, restore } from "../src/backup.ts";
test("encrypted backup restores BSON, ledger snapshots, indexes and receipt bytes; rejects tampering and occupied targets", { timeout: 180000 }, async () => {
  const cluster = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const source = await mongoose.createConnection(cluster.getUri("backup_source")).asPromise();
  const target = await mongoose.createConnection(cluster.getUri("restore_test")).asPromise();
  try {
    const receipt = Buffer.from("%PDF-1.7 fictional backup fixture");
    await source.db!.collection("users").insertOne({ email: "backup@example.test", createdAt: new Date(), password: "fictional-hash" });
    await source.db!.collection("users").createIndex({ email: 1 }, { unique: true });
    await source.db!.collection("messes").insertOne({ revision: 4, data: { deposits: [{ amount: 12345, status: "approved" }], closed: { "2026-08": { total: 12345 } } } });
    await source.db!.collection("uploads").insertOne({ key: "fixture/receipt", contentType: "application/pdf", size: receipt.length });
    const archive = await capture(source, async () => ({ Body: { transformToByteArray: async () => receipt } }));
    const secret = randomBytes(32).toString("base64"), encrypted = seal(archive, secret);
    assert.equal(encrypted.includes(Buffer.from("backup@example.test")), false);
    const decoded = unseal(encrypted, secret);
    const copied: Buffer[] = [];
    const result = await restore(decoded, target, async (_key, bytes) => { copied.push(bytes); });
    assert.equal(result.reconciled, true); assert.deepEqual(copied[0], receipt);
    await assert.rejects(() => restore(decoded, target, async () => {}), /empty/);
    await assert.rejects(() => target.db!.collection("users").insertOne({ email: "backup@example.test" }), /duplicate/);
    encrypted[encrypted.length - 1] ^= 1;
    assert.throws(() => unseal(encrypted, secret));
  } finally { await source.close(); await target.close(); await cluster.stop(); }
});
