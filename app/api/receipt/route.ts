import {
  context,
  bucket,
  AppError,
  respondError,
  sameOrigin,
} from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const c = await context(
      new URL(request.url).searchParams.get("household") || undefined,
    );
    if (Number(request.headers.get("Content-Length") || 0) > 5300000)
      throw new AppError("Receipt must be smaller than 5 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
      throw new AppError("Choose a receipt smaller than 5 MB.");
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    )
      throw new AppError("Upload a JPG, PNG, WebP, or PDF receipt.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216
        : file.type === "image/png"
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : file.type === "application/pdf"
            ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
            : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
              new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
    if (!valid) throw new AppError("The receipt does not match its file type.");
    const key = c.row.id + "/" + crypto.randomUUID();
    await bucket().put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { owner: c.user.userId },
    });
    return Response.json({ key });
  } catch (e) {
    return respondError(e);
  }
}
export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key") || "";
    const c = await context(key.split("/")[0] || undefined);
    if (!key.startsWith(c.row.id + "/"))
      throw new AppError("Receipt not found.", 404);
    const file = await bucket().get(key);
    if (!file) throw new AppError("Receipt not found.", 404);
    return new Response(file.body, {
      headers: {
        "Content-Type":
          file.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    return respondError(e);
  }
}
