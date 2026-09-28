let csrf = "";
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
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  if (data.csrf) setCsrf(data.csrf);
  return data;
}
export async function upload(mess: string, file: File) {
  if (file.size > 4 * 1024 * 1024) throw new Error(localStorage.getItem("language") === "en" ? "File must be 4 MB or smaller" : "ফাইল সর্বোচ্চ ৪ এমবি হতে পারবে");
  const body = new FormData();
  body.set("file", file);
  const r = await fetch(`/api/messes/${mess}/files`, {
    method: "POST",
    headers: { "X-CSRF-Token": csrf },
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data.key as string;
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
