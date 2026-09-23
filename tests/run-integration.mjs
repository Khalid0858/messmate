import { Miniflare } from "miniflare";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

if (!fs.existsSync("dist/server/index.js"))
  throw Error("Run npm run build before the integration suite.");
const mf = new Miniflare({
  modules: [
    "index.js",
    ...fs
      .readdirSync("dist/server", { recursive: true })
      .filter((n) => n.endsWith(".js") && n !== "index.js"),
  ].map((n) => ({ type: "ESModule", path: path.resolve("dist/server", n) })),
  modulesRoot: path.resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js"], fallthrough: true }],
  compatibilityDate: "2026-05-01",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  host: "127.0.0.1",
  port: 0,
});
try {
  const ready = await mf.ready;
  const db = await mf.getD1Database("DB");
  for (const migration of fs
    .readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    for (const statement of fs
      .readFileSync("drizzle/" + migration, "utf8")
      .split("--> statement-breakpoint")
      .filter((s) => s.trim()))
      await db.prepare(statement).run();
  }
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["tests/integration.mjs"], {
      stdio: "inherit",
      env: { ...process.env, MESSMATE_TEST_ORIGIN: ready.origin },
    });
    child.once("error", reject);
    child.once("exit", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  await mf.dispose();
}
