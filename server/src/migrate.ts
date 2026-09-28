import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { migrateLedger } from "./migration.ts";
import { connect, Mess, User } from "./models.ts";
const [sourcePath, mappingPath, mode = "--dry-run"] = process.argv.slice(2);
if (!sourcePath || !mappingPath || !["--dry-run", "--apply"].includes(mode))
  throw new Error(
    "Usage: npm run migrate -- source.json mapping.json [--dry-run|--apply]",
  );
const source = JSON.parse(await readFile(sourcePath, "utf8")),
  mapping = JSON.parse(await readFile(mappingPath, "utf8"));
if (mapping.ownerProofVerified !== true)
  throw new Error(
    "Verify legacy owner identity through the old authenticated account and record ownerProofVerified in the protected mapping file",
  );
const { data, report } = migrateLedger(source.data || source, mapping);
console.log(JSON.stringify(report, null, 2));
if (mode === "--apply") {
  if ([...data.deposits, ...data.expenses].some((x) => x.status === "pending"))
    throw new Error(
      "Resolve pending reviews in the legacy system and export again before cutover",
    );
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  await connect(process.env.MONGODB_URI);
  try {
    const owner = await User.findById(mapping.ownerUserId);
    if (!owner?.verified)
      throw new Error("Target owner must be a verified account");
    const existing = await Mess.findOne({ legacyId: mapping.legacyId });
    if (existing) {
      if (existing.data.legacy?.sourceHash !== report.sourceHash)
        throw new Error(
          "Different source already imported; refusing overwrite",
        );
      console.log("Already imported; no changes");
    } else {
      await writeFile(sourcePath + ".backup.json", JSON.stringify(source), {
        flag: "wx",
        mode: 0o600,
      });
      const m = await Mess.create({
        legacyId: mapping.legacyId,
        adminId: mapping.ownerUserId,
        userIds: [mapping.ownerUserId],
        data,
      });
      console.log("Imported mess ID: " + m._id);
    }
  } finally {
    await mongoose.disconnect();
  }
}
