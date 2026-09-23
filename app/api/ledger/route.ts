import { context, db, AppError, respondError, sameOrigin } from "@/lib/server";
import { applyAction, RuleError } from "@/lib/actions";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await context(
      new URL(request.url).searchParams.get("household") || undefined,
    );
    return Response.json(
      {
        data: c.data,
        version: c.row.version,
        role: c.manager ? "manager" : "member",
        memberId: c.member?.id,
        householdId: c.row.id,
        workspaces: c.workspaces,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return respondError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!request.headers.get("Content-Type")?.includes("application/json"))
      throw new AppError("JSON is required.", 415);
    if (Number(request.headers.get("Content-Length") || 0) > 20000)
      throw new AppError("Request too large.", 413);
    const body = await request.text();
    if (body.length > 20000) throw new AppError("Request too large.", 413);
    let input;
    try {
      input = JSON.parse(body);
    } catch {
      throw new AppError("Invalid JSON.");
    }
    if (
      !input ||
      typeof input.action !== "string" ||
      !input.payload ||
      typeof input.payload !== "object" ||
      Array.isArray(input.payload)
    )
      throw new AppError("Invalid request.");
    const c = await context(
      typeof input.householdId === "string" ? input.householdId : undefined,
    );
    if (input.version !== c.row.version)
      throw new AppError(
        "Someone updated this mess. Reload the latest data, then try again.",
        409,
      );
    try {
      applyAction(c.data, input.action, input.payload, {
        manager: c.manager,
        memberId: c.member?.id,
        email: c.user.email,
        household: c.row.id,
      });
    } catch (e) {
      if (e instanceof RuleError) throw new AppError(e.message);
      throw e;
    }
    const serialized = JSON.stringify(c.data);
    if (serialized.length > 1500000)
      throw new AppError(
        "Workspace storage limit reached. Export your records and contact support.",
      );
    const result = await db()
      .prepare(
        "UPDATE households SET data = ?, version = version + 1 WHERE id = ? AND version = ?",
      )
      .bind(serialized, c.row.id, c.row.version)
      .run();
    if (result.meta.changes !== 1)
      throw new AppError(
        "Another update was saved first. Reload and retry.",
        409,
      );
    return Response.json(
      {
        data: c.data,
        version: c.row.version + 1,
        memberId: c.data.members.find(
          (m) => m.email.toLowerCase() === c.user.email.toLowerCase(),
        )?.id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return respondError(e);
  }
}
