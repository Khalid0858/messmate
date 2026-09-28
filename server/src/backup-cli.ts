import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import mongoose from "mongoose";
import { capture, seal, unseal, restore } from "./backup.ts";
import { putFile } from "./providers.ts";

const [mode, file] = process.argv.slice(2);
if (!file || !["backup", "restore"].includes(mode)) throw new Error("Usage: backup-cli.ts backup|restore /private/path/archive.mmbak");
const secret = process.env.BACKUP_KEY;
if (!secret) throw new Error("Set BACKUP_KEY through your local secret manager");
const uri = mode === "restore" ? process.env.RESTORE_MONGODB_URI : process.env.MONGODB_URI;
if (!uri) throw new Error("Missing database URI");
if (mode === "restore" && (uri === process.env.MONGODB_URI || !process.env.RESTORE_OBJECT_STORE_CONFIRMED)) throw new Error("Restore requires a separate empty database and object store; set RESTORE_OBJECT_STORE_CONFIRMED=1 after checking destination");
const connection = await mongoose.createConnection(uri).asPromise();
try {
  if (mode === "backup") {
    const archive = await capture(connection);
    writeFileSync(file, seal(archive, secret), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ saved: true, counts: Object.fromEntries(Object.entries(archive.collections).map(([name, c]) => [name, c.count])), receipts: archive.files.length }));
  } else {
    const archive = unseal(readFileSync(file), secret);
    console.log(JSON.stringify(await restore(archive, connection, putFile)));
  }
} finally { await connection.close(); }
