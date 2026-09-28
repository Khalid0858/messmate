import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connect, User, Mess } from "./models.ts";
import { hashPassword } from "./security.ts";
import { createLedger, bdDay } from "./domain.ts";
import { createApp } from "./app.ts";
import { mkdir, writeFile } from "node:fs/promises";
if (process.env.NODE_ENV === "production" || process.env.VERCEL)
  throw new Error("Local preview is forbidden in production");
const db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await connect(db.getUri());
const user = await User.create({
  name: "Demo Manager",
  email: "manager@example.test",
  password: await hashPassword("Local-preview-123!"),
  verified: true,
});
const data = createLedger("Green House — Local Test", {
  id: "demo-member",
  userId: String(user._id),
  name: "Demo Manager",
  email: user.email,
  joined: bdDay(),
});
await Mess.create({
  adminId: String(user._id),
  userIds: [String(user._id)],
  data,
});
const origin = "http://localhost:5180";
await mkdir(".local", { recursive: true });
const server = createApp({
  origin,
  mailReady: () => true,
  mailer: async (to, subject, message) => {
    await writeFile(
      ".local/inbox.json",
      JSON.stringify({ to, subject, message }),
      { mode: 0o600 },
    );
  },
}).listen(4000, "127.0.0.1", () =>
  console.log(
    "LOCAL ONLY: manager@example.test / Local-preview-123!; database is ephemeral; verification mail is in server/.local/inbox.json",
  ),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await db.stop();
    process.exit(0);
  }),
);
