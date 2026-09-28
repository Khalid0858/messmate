import "dotenv/config";
import { connect } from "./models.ts";
import { createApp } from "./app.ts";
import { dispatchNotifications } from "./notifications.ts";
if (!process.env.MONGODB_URI)
  throw new Error("MONGODB_URI is required. No in-memory production fallback.");
if (
  process.env.NODE_ENV === "production" &&
  !process.env.APP_URL?.startsWith("https://")
)
  throw new Error("Production APP_URL must use HTTPS");
await connect(process.env.MONGODB_URI);
const server = createApp().listen(
  Number(process.env.PORT || 4000),
  process.env.HOST || "0.0.0.0",
  () =>
    console.log("MessMate API listening on port " + (process.env.PORT || 4000)),
);
const timer = setInterval(
  () =>
    dispatchNotifications().catch(() =>
      console.error("Notification dispatch failed"),
    ),
  15000,
);
timer.unref();
process.on("SIGTERM", () => {
  clearInterval(timer);
  server.close(() => process.exit(0));
});
