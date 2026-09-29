import type {
  Request,
  Response,
} from "../server/node_modules/@types/express/index.js";
import { createApp } from "../server/dist/app.js";
import { connect } from "../server/dist/models.js";
import { dispatchNotifications } from "../server/dist/notifications.js";
import { operationalStatus } from "../server/dist/operations.js";
import { runBackup } from "../server/dist/backup-job.js";

// One connection promise per warm instance; never start an ephemeral production DB.
let connection: Promise<void> | undefined;
const app = createApp();
export default async function handler(req: Request, res: Response) {
  if (req.url?.split("?")[0] === "/api/health") return app(req, res);
  if (
    !process.env.MONGODB_URI ||
    !process.env.APP_URL?.startsWith("https://")
  ) {
    res.status(503).json({
      error:
        "Service setup is incomplete. Database and production URL must be configured.",
    });
    return;
  }
  try {
    connection ??= connect(process.env.MONGODB_URI).catch((e) => {
      connection = undefined;
      throw e;
    });
    await connection;
    const job = req.url?.split("?")[0];
    if (
      job === "/api/jobs/notifications" ||
      job === "/api/jobs/backup" ||
      job === "/api/jobs/monitor"
    ) {
      if (
        !process.env.CRON_SECRET ||
        req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (job === "/api/jobs/monitor") {
        const status = await operationalStatus();
        res.status(status.ok ? 200 : 503).json(status);
      } else if (job === "/api/jobs/backup") res.json(await runBackup());
      else {
        res.json({ ok: true, ...(await dispatchNotifications()) });
      }
      return;
    }
    return app(req, res);
  } catch {
    res
      .status(503)
      .json({ error: "Database temporarily unavailable. Please retry." });
  }
}
