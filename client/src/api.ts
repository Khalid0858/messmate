import { translateUi } from "./translations";
let csrf = "";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}
export function safeReturn(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/app/overview";
  try {
    const u = new URL(value, location.origin);
    return u.origin === location.origin &&
      /^\/(app(?:\/|$)|invite(?:\?|$))/.test(value)
      ? u.pathname + u.search
      : "/app/overview";
  } catch {
    return "/app/overview";
  }
}
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  url: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const r = await fetch("/api" + url, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r
    .json()
    .catch(() => ({ error: "Server response unavailable" }));
  if (!r.ok) {
    if (r.status === 401 && !url.startsWith("/auth/") && url !== "/me")
      window.dispatchEvent(new Event("messmate:expired"));
    const raw = data.error || `Request failed (${r.status})`;
    const bn = localStorage.getItem("language") !== "en";
    const errors: Record<string, string> = {
      "Email or password is incorrect": "ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
      "Verify your email before signing in": "লগইনের আগে ইমেইল যাচাই করুন।",
      "Another change was saved. Refresh and retry.":
        "অন্য একটি পরিবর্তন হয়েছে। নতুন তথ্য যাচাই করে আবার জমা দিন।",
      "Transaction reference already submitted":
        "এই transaction reference আগে জমা হয়েছে।",
      "Month is finalized": "এই মাসের হিসাব চূড়ান্ত হয়েছে।",
      "Stock cannot go negative": "মজুত শূন্যের নিচে যেতে পারে না।",
      "Link expired or already used": "লিংকটির মেয়াদ শেষ বা আগে ব্যবহার হয়েছে।",
      "Resolve pending entries first": "অপেক্ষমাণ রেকর্ডগুলো আগে যাচাই করুন।",
      "Item totals must match expense":
        "পণ্যের মোট দাম ও খরচের পরিমাণ মিলতে হবে।",
    };
    const fallback =
      r.status === 401
        ? "আপনার session শেষ হয়েছে। আবার লগইন করুন।"
        : r.status === 403
          ? "এই কাজের অনুমতি নেই।"
          : r.status === 429
            ? "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
            : r.status >= 500
              ? "সেবা সাময়িকভাবে পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।"
              : "দেওয়া তথ্য বা মেসের নিয়মের সঙ্গে এই পরিবর্তন মিলছে না। তথ্য যাচাই করুন।";
    throw new ApiError(
      bn
        ? errors[raw] ||
          (translateUi(raw, true) !== raw ? translateUi(raw, true) : fallback)
        : raw,
      r.status,
      r.headers.get("X-Request-ID") || undefined,
    );
  }
  if (data.csrf) setCsrf(data.csrf);
  return data;
}
export async function upload(
  mess: string,
  file: File,
  onProgress?: (value: number) => void,
) {
  if (file.size > 4 * 1024 * 1024)
    throw new Error(
      localStorage.getItem("language") === "en"
        ? "File must be 4 MB or smaller"
        : "ফাইল সর্বোচ্চ ৪ এমবি হতে পারবে",
    );
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest(),
      body = new FormData();
    body.set("file", file);
    request.open("POST", mess === "__profile" ? "/api/me/avatar" : `/api/messes/${mess}/files`);
    request.setRequestHeader("X-CSRF-Token", csrf);
    request.timeout = 60000;
    request.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    request.onerror = request.ontimeout = () =>
      reject(
        new Error(
          localStorage.getItem("language") === "en"
            ? "Receipt upload failed. Please retry."
            : "রসিদ আপলোড হয়নি। আবার চেষ্টা করুন।",
        ),
      );
    request.onload = () => {
      let data;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        return reject(new Error("Upload response unavailable"));
      }
      if (request.status >= 200 && request.status < 300) resolve(data.key || "");
      else {
        if (request.status === 401)
          window.dispatchEvent(new Event("messmate:expired"));
        reject(new ApiError(data.error || "Upload failed", request.status));
      }
    };
    request.send(body);
  });
}
export const money = (v: number) =>
  "৳" +
  ((v || 0) / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function csv(name: string, rows: unknown[][]) {
  const quote = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
