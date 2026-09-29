import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useLanguage } from "./language";
import { api, money } from "./api";
type Row = Record<string, any>;
export function Filters({
  fields,
}: {
  fields: [string, string, [string, string][]][];
}) {
  const [params, set] = useSearchParams(),
    { t } = useLanguage();
  const update = (key: string, value: string) =>
    set(
      (old) => {
        const next = new URLSearchParams(old);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  return (
    <div className="filters filter-panel">
      {fields.map(([key, label, options]) => (
        <label key={key}>
          {label}
          <select
            value={params.get(key) || ""}
            onChange={(e) => update(key, e.target.value)}
          >
            <option value="">{t("All", "সব")}</option>
            {options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ))}
      {["from", "to"].map((key) => (
        <label key={key}>
          {key === "from" ? t("From", "শুরু") : t("To", "শেষ")}
          <input
            type="date"
            value={params.get(key) || ""}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}
      <button
        onClick={() =>
          set((old) => {
            const n = new URLSearchParams(old);
            [
              ...fields.map((x) => x[0]),
              "from",
              "to",
              "search",
              "status",
            ].forEach((k) => n.delete(k));
            return n;
          })
        }
      >
        {t("Clear filters", "ফিল্টার মুছুন")}
      </button>
    </div>
  );
}
export function InvitationList({
  active,
  invites,
  refresh,
  onLink,
}: {
  active: string;
  invites: Row[];
  refresh: () => Promise<void>;
  onLink: (s: string) => void;
}) {
  const { t, bn } = useLanguage(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState("");
  async function run(email: string, revoke = false) {
    setBusy(true);
    setError("");
    try {
      const r = await api(
        "/messes/" + active + "/invites" + (revoke ? "/revoke" : ""),
        { email },
      );
      if (r.url) {
        setLink(r.url);
        onLink(
          t(
            "New invitation ready. The old link no longer works.",
            "নতুন আমন্ত্রণ প্রস্তুত। পুরোনো লিংক আর কাজ করবে না।",
          ),
        );
      }
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{t("Invitations", "আমন্ত্রণ")}</h2>
      <p>
        {t(
          "Regenerating creates a new private link. Share it only with the invited address.",
          "নতুন লিংক শুধু আমন্ত্রিত সদস্যকে দিন।",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {link && (
        <>
          <input
            readOnly
            aria-label={t("Invitation link", "আমন্ত্রণের লিংক")}
            value={link}
          />
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .catch(() =>
                  setError(
                    t(
                      "Select and copy the link.",
                      "লিংক নির্বাচন করে কপি করুন।",
                    ),
                  ),
                )
            }
          >
            {t("Copy link", "লিংক কপি")}
          </button>
        </>
      )}
      {!invites.length && (
        <p>{t("No pending invitations.", "কোনো আমন্ত্রণ অপেক্ষায় নেই।")}</p>
      )}
      {invites.map((x) => (
        <div className="invitation-row" key={x.email}>
          <strong>{x.email}</strong>
          <span>
            {x.expiresAt > Date.now()
              ? t("Pending", "অপেক্ষমাণ")
              : t("Expired", "মেয়াদ শেষ")}{" "}
            · {new Date(x.expiresAt).toLocaleDateString(bn ? "bn-BD" : "en-GB")}
          </span>
          <button disabled={busy} onClick={() => run(x.email)}>
            {t("Generate replacement link", "নতুন লিংক তৈরি")}
          </button>
          <button disabled={busy} onClick={() => run(x.email, true)}>
            {t("Revoke", "বাতিল")}
          </button>
        </div>
      ))}
    </section>
  );
}
export function StockSummary({
  data,
  month,
  manager,
  onThreshold,
}: {
  data: Row;
  month: string;
  manager: boolean;
  onThreshold: () => void;
}) {
  const { t } = useLanguage();
  const keys = [
    ...new Set<string>(data.stock.map((x: Row) => x.name + "|" + x.unit)),
  ];
  return (
    <section>
      <h3>
        {t("Monthly stock summary", "মাসের মজুতের হিসাব")} · {month}
      </h3>
      {manager && (
        <button onClick={onThreshold}>
          {t("Set low-stock threshold", "কম মজুতের সীমা দিন")}
        </button>
      )}
      <div className="stock-cards">
        {keys.map((key) => {
          const [name, unit] = key.split("|"),
            all = data.stock.filter(
              (x: Row) => x.name === name && x.unit === unit,
            ),
            before = all
              .filter((x: Row) => x.date.slice(0, 7) < month)
              .reduce((n: number, x: Row) => n + x.quantity, 0),
            now = all.filter((x: Row) => x.date.startsWith(month)),
            sum = (list: Row[]) =>
              Math.round(
                list.reduce((n: number, x: Row) => n + x.quantity, 0) * 10000,
              ) / 10000,
            close = before + sum(now),
            threshold = data.stockThresholds?.find(
              (x: Row) => x.name === name && x.unit === unit,
            )?.minimum;
          return (
            <article className="panel" key={key}>
              <h3>
                {name} ({unit})
              </h3>
              <p>
                {t("Opening", "শুরু")}: {before}
              </p>
              <p>
                {t("Received", "এসেছে")}:{" "}
                {sum(now.filter((x: Row) => x.quantity > 0))}
              </p>
              <p>
                {t("Used", "ব্যবহৃত")}:{" "}
                {Math.abs(sum(now.filter((x: Row) => x.quantity < 0)))}
              </p>
              <strong>
                {t("Closing", "শেষ")}: {close}
              </strong>
              {threshold !== undefined && close < threshold && (
                <p className="error">
                  {t("Below threshold", "সীমার চেয়ে কম")}: {threshold}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function SettlementSummary({
  data,
  report,
  month,
  memberName,
}: {
  data: Row;
  report: Row;
  month: string;
  memberName: (id: string) => string;
}) {
  const { t } = useLanguage(),
    [params, setParams] = useSearchParams();
  const member = params.get("statementMember") || "",
    setMember = (v: string) =>
      setParams(
        (old) => {
          const n = new URLSearchParams(old);
          if (v) n.set("statementMember", v);
          else n.delete("statementMember");
          return n;
        },
        { replace: true },
      );
  const records = report.rows.filter((x: Row) => !member || x.id === member);
  const pending = [
    ...data.deposits,
    ...data.expenses,
    ...data.corrections,
  ].filter(
    (x: Row) => x.date.startsWith(month) && x.status === "pending",
  ).length;
  const categories: Row = {};
  data.expenses
    .filter((x: Row) => x.date.startsWith(month) && x.status === "approved")
    .forEach((x: Row) => {
      categories[x.category] = (categories[x.category] || 0) + x.amount;
    });
  return (
    <>
      <section className="panel">
        <h3>{t("Month-end review", "মাসশেষের যাচাই")}</h3>
        <p>
          {t("Pending records", "অপেক্ষমাণ রেকর্ড")}: {pending}
        </p>
        <p>
          {t("Unallocated cost", "ভাগ হয়নি এমন খরচ")}:{" "}
          {money(report.unallocated)}
        </p>
        <p>
          {t("Open previous months", "আগের অসমাপ্ত মাস")}:{" "}
          {[
            ...new Set<string>(
              [...data.meals, ...data.expenses, ...data.deposits].map(
                (x: Row) => x.date.slice(0, 7),
              ),
            ),
          ]
            .filter((m) => m < month && !data.closed[m])
            .join(", ") || "—"}
        </p>
        <Link to={"/app/bazar?month=" + month}>
          {t("Review advances and questions", "অগ্রিম ও প্রশ্ন যাচাই")}
        </Link>
        <h3>{t("Approved category totals", "অনুমোদিত খাতভিত্তিক খরচ")}</h3>
        {Object.entries(categories).map(([k, v]) => (
          <p key={k}>
            {k}: {money(Number(v))}
          </p>
        ))}
      </section>
      <section className="panel">
        <h3>{t("Member statement", "সদস্যের হিসাব")}</h3>
        <label>
          {t("Member", "সদস্য")}
          <select value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">{t("All members", "সব সদস্য")}</option>
            {report.rows.map((x: Row) => (
              <option key={x.id} value={x.id}>
                {memberName(x.id)}
              </option>
            ))}
          </select>
        </label>
        {member &&
          records.map((x: Row) => (
            <article key={x.id}>
              <h3>{memberName(x.id)}</h3>
              <p>
                {t(
                  "Opening / allocated / verified deposits",
                  "আগের হিসাব / খরচ / যাচাইকৃত জমা",
                )}
                : {money(x.opening)} / {money(x.cost)} / {money(x.deposits)}
              </p>
              <strong>
                {x.due < 0
                  ? t("Member credit", "ফেরত পাবেন")
                  : t("Amount due", "দিতে হবে")}
                : {money(Math.abs(x.due))}
              </strong>
            </article>
          ))}
      </section>
    </>
  );
}
