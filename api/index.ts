import type {
  Request,
  Response,
} from "../server/node_modules/@types/express/index.js";
import { createApp } from "../server/dist/app.js";
import { connect } from "../server/dist/models.js";
import { dispatchNotifications } from "../server/dist/notifications.js";

// One connection promise per warm instance; never start an ephemeral production DB.
let connection: Promise<void> | undefined;
const app = createApp();
export default async function handler(req: Request, res: Response) {
  if (req.url?.split("?")[0] === "/api/health") return app(req, res);
  if (
    !process.env.MONGODB_URI ||
    !process.env.APP_URL?.startsWith("https://")
  ) {
    res
      .status(503)
      .json({
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
    if (req.url?.split("?")[0] === "/api/jobs/notifications") {
      if (
        !process.env.CRON_SECRET ||
        req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      await dispatchNotifications();
      res.json({ ok: true });
      return;
    }
    return app(req, res);
  } catch {
    res
      .status(503)
      .json({ error: "Database temporarily unavailable. Please retry." });
  }
}
