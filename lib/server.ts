import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { emptyLedger, type Ledger } from "./ledger";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB)
    throw new AppError(
      "Database is unavailable. Please try again shortly.",
      503,
    );
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET)
    throw new AppError(
      "Receipt storage is unavailable. Please try again shortly.",
      503,
    );
  return env.BUCKET;
}
export async function context(householdId?: string) {
  const user = await getChatGPTUser();
  if (!user) throw new AppError("Please sign in.", 401);
  // Stable user ID owns a mess; emails are explicit manager invitations only.
  const accessible = await db()
    .prepare(
      "SELECT h.* FROM households h WHERE h.owner = ? OR EXISTS (SELECT 1 FROM json_each(h.data, '$.members') m WHERE lower(json_extract(m.value, '$.email')) = ?) ORDER BY CASE WHEN h.owner = ? THEN 0 ELSE 1 END, h.id",
    )
    .bind(user.userId, user.email.toLowerCase(), user.userId)
    .all<{ id: string; owner: string; data: string; version: number }>();
  let row = householdId
    ? accessible.results.find((h) => h.id === householdId)
    : accessible.results[0];
  if (householdId && !row)
    throw new AppError("You do not have access to this mess.", 403);
  if (!row) {
    await db()
      .prepare(
        "INSERT OR IGNORE INTO households (id,owner,data,version) VALUES (?,?,?,0)",
      )
      .bind(crypto.randomUUID(), user.userId, JSON.stringify(emptyLedger()))
      .run();
    row =
      (await db()
        .prepare("SELECT * FROM households WHERE owner = ?")
        .bind(user.userId)
        .first()) || undefined;
  }
  if (!row)
    throw new AppError("Could not create your workspace. Please retry.", 503);
  const data = JSON.parse(row.data) as Ledger,
    manager = row.owner === user.userId,
    member = data.members.find(
      (m) => m.email.toLowerCase() === user.email.toLowerCase(),
    );
  const workspaces = (
    accessible.results.length ? accessible.results : [row]
  ).map((h) => ({
    id: h.id,
    name: (JSON.parse(h.data) as Ledger).name,
    role: h.owner === user.userId ? "manager" : "member",
  }));
  return { user, row, data, manager, member, workspaces };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin)
    throw new AppError("This request must come from MessMate.", 403);
}
export function respondError(e: unknown) {
  if (e instanceof AppError)
    return Response.json({ error: e.message }, { status: e.status });
  console.error("MessMate request failed", e);
  return Response.json(
    {
      error:
        "Could not complete the request. Your changes were not saved. Please retry.",
    },
    { status: 503 },
  );
}
