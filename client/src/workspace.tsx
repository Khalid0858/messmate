import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  Link,
} from "react-router-dom";
import { Dialog } from "radix-ui";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBasket,
  Wallet,
  Users,
  ClipboardList,
  Package,
  Settings,
  Bell,
  History,
  LogOut,
  Menu,
  X,
  Plus,
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  ChevronRight,
} from "lucide-react";
import { ApiError, api, money, today, csv, upload } from "./api";
import { Brand } from "./brand";
import { useLanguage } from "./language";
import { translateUi } from "./translations";
import { StructuredField } from "./structured-field";
import {
  Filters,
  StockSummary,
  SettlementSummary,
  InvitationList,
} from "./workspace-extras";
type Row = Record<string, any>;
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: any;
  options?: [string, string][];
  optional?: boolean;
};
type Form = {
  title: string;
  action: string;
  fields: Field[];
  preset?: Row;
  requestId: string;
  endpoint?: string;
  transform?: (p: Row) => Row;
  info?: string;
  uploads?: Record<string, { digest: string; key: string }>;
};
const navs = [
  ["overview", "Overview", "সারসংক্ষেপ", LayoutDashboard],
  ["meals", "Meals & menu", "মিল ও মেনু", UtensilsCrossed],
  ["bazar", "Bazar & expenses", "বাজার ও খরচ", ShoppingBasket],
  ["deposits", "Deposits", "টাকা জমা", Wallet],
  ["members", "Members", "সদস্য", Users],
  ["settlement", "Settlement", "মাসিক হিসাব", ClipboardList],
  ["stock", "Stock", "মজুত", Package],
  ["notices", "Notice board", "নোটিশ", Bell],
  ["activity", "Activity", "পরিবর্তনের ইতিহাস", History],
  ["settings", "Settings", "সেটিংস", Settings],
] as const;
function Table({
  headers,
  rows,
  empty = "No records yet.",
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  const { bn } = useLanguage();
  const ui = (value: string) => translateUi(value, bn);
  const [page, setPage] = useState(0),
    pages = Math.ceil(rows.length / 20),
    safe = Math.min(page, Math.max(0, pages - 1));
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{ui(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(safe * 20, safe * 20 + 20).map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} data-label={ui(headers[j])}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty">
          <ClipboardList />
          <p>{ui(empty)}</p>
        </div>
      )}
      {pages > 1 && (
        <div className="pagination">
          <button disabled={!safe} onClick={() => setPage(safe - 1)}>
            {ui("Previous")}
          </button>
          <span>
            {safe + 1} / {pages}
          </span>
          <button
            disabled={safe + 1 >= pages}
            onClick={() => setPage(safe + 1)}
          >
            {ui("Next")}
          </button>
        </div>
      )}
    </>
  );
}
function Status({ s }: { s: string }) {
  const { bn } = useLanguage();
  return <span className={"badge " + s}>{translateUi(s, bn)}</span>;
}
export function Workspace({ user }: { user: Row }) {
  const { t, bn, toggle } = useLanguage(),
    nav = useNavigate(),
    qc = useQueryClient();
  const ui = (value: string) => translateUi(value, bn);
  const [mess, setMess] = useState(localStorage.getItem("activeMess") || ""),
    [drawer, setDrawer] = useState(false),
    [form, setForm] = useState<Form | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null),
    [setupHidden, hideSetup] = useState(false);
  const loc = useLocation(),
    [params, setParams] = useSearchParams();
  const tab = loc.pathname.split("/")[2] || "overview";
  const month = /^\d{4}-\d{2}$/.test(params.get("month") || "")
    ? params.get("month")!
    : today().slice(0, 7);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "")
    ? params.get("date")!
    : today();
  const search = params.get("search") || "",
    status = params.get("status") || "all";
  const setParam = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const setMonth = (value: string) => setParam("month", value),
    setDate = (value: string) => setParam("date", value),
    setSearch = (value: string) => setParam("search", value),
    setStatus = (value: string) => setParam("status", value);
  const setTab = (value: string) => {
    const next = new URLSearchParams();
    next.set("month", month);
    nav("/app/" + value + "?" + next);
    setNotice("");
    setError("");
  };
  const [mobile, setMobile] = useState(
      () => matchMedia("(max-width:800px)").matches,
    ),
    wasDrawer = useRef(false);
  useEffect(() => {
    const query = matchMedia("(max-width:800px)"),
      change = () => setMobile(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    if (drawer)
      (
        document.querySelector('[aria-label="Close navigation"]') as HTMLElement
      )?.focus();
    else if (wasDrawer.current)
      (
        document.querySelector('[aria-label="Open navigation"]') as HTMLElement
      )?.focus();
    wasDrawer.current = drawer;
    const key = (event: KeyboardEvent) => {
      if (!drawer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawer(false);
      }
      if (event.key === "Tab") {
        const list = Array.from(
            document.querySelectorAll<HTMLElement>(
              ".sidebar a,.sidebar button,.sidebar select",
            ),
          ).filter((x) => !x.hasAttribute("disabled")),
          first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [drawer, mobile]);
  const messes = useQuery({
    queryKey: ["messes"],
    refetchInterval: form ? false : 60000,
    queryFn: () => api<Row[]>("/messes"),
  });
  const active =
    mess && messes.data?.some((x) => x.id === mess)
      ? mess
      : messes.data?.[0]?.id;
  const state = useQuery({
    queryKey: ["mess", active],
    queryFn: () => api("/messes/" + active),
    enabled: !!active,
    refetchInterval: form ? false : 30000,
    refetchOnWindowFocus: !form,
  });
  const report = useQuery({
    queryKey: ["report", active, month, state.data?.revision],
    queryFn: () => api(`/messes/${active}/settlement/${month}`),
    enabled: !!active,
  });
  const d = state.data?.data,
    admin = state.data?.role === "admin",
    manager = admin || state.data?.role === "manager",
    myId = state.data?.memberId,
    memberOptions = (d?.members || [])
      .filter((m: Row) => manager || m.id === myId)
      .map(
        (m: Row) =>
          [
            m.id,
            `${m.name} · ${m.email || "#" + ((d?.members || []).indexOf(m) + 1)}`,
          ] as [string, string],
      );
  const name = (id: string) => {
    const m = d?.members.find((m: Row) => m.id === id);
    return m
      ? `${m.name} · ${m.email || "#" + (d.members.indexOf(m) + 1)}`
      : ui("Former member");
  };
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["mess", active] });
    await qc.invalidateQueries({ queryKey: ["messes"] });
  };
  const open = (
    title: string,
    action: string,
    fields: Field[],
    extra: Partial<Form> = {},
  ) => {
    setError("");
    setNotice("");
    setForm({
      title,
      action,
      fields,
      requestId: crypto.randomUUID(),
      ...extra,
    });
  };
  const f = (
    name: string,
    label: string,
    type = "text",
    value?: any,
  ): Field => ({ name, label, type, value });
  const memberField = (field = "memberId"): Field => ({
    name: field,
    label: t("Member", "সদস্য"),
    options: memberOptions,
    value: myId,
  });
  const dateField = f("date", t("Date", "তারিখ"), "date", date);
  const amountField = f("amount", t("Amount (BDT)", "পরিমাণ (টাকা)"), "number");
  const reason = f(
    "reason",
    t("Reason / verification note", "কারণ / যাচাইয়ের বিবরণ"),
    "textarea",
  );
  const memberAll: Field = {
    ...memberField(),
    options: (d?.members || []).map((m: Row) => [m.id, name(m.id)]),
  };
  const run = async (kind: string, p: Row) => {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/messes/${active}/actions`, {
        action: kind,
        payload: p,
        revision: state.data.revision,
        requestId: crypto.randomUUID(),
      });
      qc.setQueryData(["mess", active], result);
      setNotice("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  function mealForm(recurring = false) {
    open(
      t(
        recurring ? "Weekly meal preferences" : "Book meals",
        recurring ? "সাপ্তাহিক মিলের পছন্দ" : "মিল বুক করুন",
      ),
      recurring ? "recurring" : "meal_range",
      [
        memberField(),
        f("start", "From", "date", date),
        f("end", "Through (max 62 days)", "date", date),
        ...["breakfast", "lunch", "dinner"].map((s) =>
          f(s, s + " portions (0 / 0.5 / 1 / guests)", "meal", 0),
        ),
        ...(recurring
          ? [
              f(
                "weekdays",
                "Weekdays: Sunday=0 … Saturday=6",
                "json",
                "[0,1,2,3,4,5,6]",
              ),
            ]
          : []),
        { ...reason, optional: true },
      ],
      {
        info: recurring
          ? "Existing dated bookings are exceptions and will not be overwritten. Preferences are materialized only within this range."
          : "Confirmed bookings are billable. Zero turns a meal off. Dates save together or not at all.",
      },
    );
  }
  function expenseForm() {
    open("Submit expense", "expense", [
      f("title", "Purchase / bill"),
      dateField,
      memberField("paidBy"),
      amountField,
      {
        name: "category",
        label: "Category",
        options: Object.keys(d.rules.at(-1).categories).map((x) => [x, x]),
      },
      {
        name: "source",
        label: "Money source",
        options: [
          ["fund", "Mess fund"],
          ["personal", "Personal money"],
          ["advance", "Bazar advance"],
        ],
      },
      {
        name: "advanceId",
        label: "Advance (when using advance)",
        optional: true,
        options: [
          ["", "None"],
          ...d.advances.map((x: Row) => [
            x.id,
            `${name(x.memberId)} · ${money(x.amount)} · ${x.date}`,
          ]),
        ],
      },
      {
        ...f("items", "Item list: name, quantity, unit, paisa", "json", "[]"),
        optional: true,
      },
      {
        ...f(
          "fixed",
          "Fixed shares if required: member ID → paisa",
          "json",
          "{}",
        ),
        optional: true,
      },
      {
        name: "receipt",
        label: "Receipt (JPG/PNG/WebP/PDF, 4 MB)",
        type: "file",
        optional: true,
      },
    ]);
  }
  const members = d?.members || [],
    allDeposits = (d?.deposits || []).filter((x: Row) =>
      x.date.startsWith(month),
    ),
    deposits = allDeposits.filter(
      (x: Row) =>
        (status === "all" || x.status === status) &&
        (name(x.memberId) + " " + (x.transactionId || ""))
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!params.get("provider") || x.provider === params.get("provider")) &&
        (!params.get("member") || x.memberId === params.get("member")) &&
        (!params.get("from") || x.date >= params.get("from")!) &&
        (!params.get("to") || x.date <= params.get("to")!),
    ),
    allExpenses = (d?.expenses || []).filter((x: Row) =>
      x.date.startsWith(month),
    ),
    expenses = allExpenses.filter(
      (x: Row) =>
        (!params.get("expenseStatus") ||
          x.status === params.get("expenseStatus")) &&
        (!params.get("category") || x.category === params.get("category")) &&
        (!params.get("purchaser") || x.paidBy === params.get("purchaser")) &&
        (!params.get("source") || x.source === params.get("source")) &&
        (!params.get("from") || x.date >= params.get("from")!) &&
        (!params.get("to") || x.date <= params.get("to")!),
    ),
    pending =
      allDeposits.filter((x: Row) => x.status === "pending").length +
      allExpenses.filter((x: Row) => x.status === "pending").length +
      (d?.corrections || []).filter(
        (x: Row) => x.date.startsWith(month) && x.status === "pending",
      ).length;
  const button = (
    label: string,
    fn: () => void,
    primary = false,
    disabled = false,
  ) => (
    <button
      className={"button " + (primary ? "dark" : "outline")}
      onClick={fn}
      disabled={busy || disabled}
    >
      {ui(label)}
    </button>
  );
  const rowReview = (kind: string, id: string) =>
    button("Review", () =>
      open(
        "Verify record",
        kind,
        [
          {
            name: "status",
            label: "Decision",
            options: [
              ["approved", "Approve"],
              ["rejected", "Reject"],
            ],
          },
          reason,
          ...(kind === "deposit_review"
            ? [
                f(
                  "verified",
                  "I checked transaction ID, amount and recipient in my wallet",
                  "checkbox",
                  false,
                ),
              ]
            : []),
        ],
        { preset: { id } },
      ),
    );
  const content = () => {
    if (!navs.some((n) => n[0] === tab))
      return (
        <section className="panel">
          <h2>404</h2>
          <Link to="/app/overview">{ui("Overview")}</Link>
        </section>
      );
    if (messes.isPending)
      return <p role="status">{ui("Loading your mess…")}</p>;
    if (!active)
      return (
        <section className="welcome panel">
          <span className="eyebrow">{ui("WELCOME TO MESSMATE")}</span>
          <h1>
            {t("Your shared table starts here.", "একসাথে থাকার শুরু এখানেই।")}
          </h1>
          <p>
            {t(
              "Create a mess, or use an invitation link from your admin.",
              "মেস তৈরি করুন অথবা Admin-এর আমন্ত্রণের লিংক ব্যবহার করুন।",
            )}
          </p>
          {button(
            t("Create a mess", "মেস তৈরি করুন"),
            () =>
              open("Create a mess", "", [f("name", "Mess name")], {
                endpoint: "/messes",
              }),
            true,
          )}
        </section>
      );
    if (state.isPending)
      return <div className="loading">{ui("Loading your mess…")}</div>;
    if (state.error)
      return (
        <div className="error">
          {state.error.message}
          <button onClick={() => state.refetch()}>{ui("Retry")}</button>
        </div>
      );
    if (!d) return null;
    if (tab === "overview")
      return (
        <>
          {!setupHidden && (
            <section className="panel setup-checklist">
              <div className="panel-heading">
                <h2>{t("Your next steps", "পরবর্তী কাজ")}</h2>
                <button onClick={() => hideSetup(true)}>
                  {t("Hide for now", "এখন লুকান")}
                </button>
              </div>
              {(manager
                ? [
                    [!!d.location, "Mess details", "মেসের তথ্য", "settings"],
                    [
                      d.members.length > 1,
                      "Invite members",
                      "সদস্য আমন্ত্রণ",
                      "members",
                    ],
                    [
                      !!d.managers[month],
                      "Assign monthly manager",
                      "মাসের ম্যানেজার ঠিক করুন",
                      "members",
                    ],
                    [
                      d.accounts.some((x: Row) => x.enabled),
                      "Receiving account",
                      "জমার নম্বর",
                      "deposits",
                    ],
                    [
                      d.menus.some((x: Row) => x.date >= today()),
                      "Menu and deadlines",
                      "মেনু ও শেষ সময়",
                      "meals",
                    ],
                    [
                      d.rules.length > 1,
                      "Review sharing rules",
                      "খরচ ভাগের নিয়ম যাচাই",
                      "settings",
                    ],
                    [
                      d.stock.length > 0,
                      "Opening stock, if applicable",
                      "প্রযোজ্য হলে শুরুর মজুত",
                      "stock",
                    ],
                    [
                      d.duties.length > 0,
                      "Assign bazar duty",
                      "বাজারের পালা দিন",
                      "bazar",
                    ],
                  ]
                : [
                    [
                      !!d.meals.find((x: Row) => x.memberId === myId),
                      "Plan your meals",
                      "নিজের মিল ঠিক করুন",
                      "meals",
                    ],
                    [
                      deposits.some((x: Row) => x.memberId === myId),
                      "Review deposit instructions",
                      "জমার নিয়ম দেখুন",
                      "deposits",
                    ],
                  ]
              ).map(([done, en, b, path]) => (
                <button
                  className="setup-step"
                  key={String(path) + String(en)}
                  onClick={() => setTab(String(path))}
                >
                  {done ? "✓" : "○"} {t(String(en), String(b))}
                </button>
              ))}
            </section>
          )}
          <section className="workspace-banner">
            <div>
              <span className="eyebrow">
                {t(
                  "A LITTLE CLARITY, EVERY DAY",
                  "প্রতিদিনের হিসাব হোক স্বচ্ছ",
                )}
              </span>
              <h2>
                {t(
                  "Welcome to your shared table.",
                  "আপনার মেসের খাতায় স্বাগতম।",
                )}
              </h2>
              <p>
                {d.name} · {d.location || "Bangladesh"} ·{" "}
                {
                  members.filter((m: Row) => !m.left || m.left >= today())
                    .length
                }{" "}
                {t("members", "সদস্য")}
              </p>
            </div>
            <button
              className="button light"
              onClick={() => {
                setTab("meals");
                mealForm();
              }}
            >
              <Plus size={17} />
              {t("Plan my meals", "নিজের মিল ঠিক করুন")}
            </button>
          </section>
          <p>
            {t("Accounting month", "হিসাবের মাস")}: {month} · {t("Today", "আজ")}
            : {today()}
          </p>
          {report.isPending ? (
            <p role="status">{t("Loading balances…", "হিসাব আসছে…")}</p>
          ) : report.isError ? (
            <p role="alert" className="error">
              {t(
                "Balances unavailable. A zero balance has not been assumed.",
                "হিসাব পাওয়া যায়নি। শূন্য ধরে নেওয়া হয়নি।",
              )}{" "}
              <button onClick={() => report.refetch()}>{ui("Retry")}</button>
            </p>
          ) : (
            <div className="stats-grid">
              {[
                [
                  t("Fund cash", "ফান্ডের টাকা"),
                  money(report.data?.cash),
                  "Including advances and actual payouts",
                ],
                [
                  t("Meal rate", "মিল রেট"),
                  money(
                    report.data?.totalMeals
                      ? report.data.food / report.data.totalMeals
                      : 0,
                  ),
                  "Food / weighted meals",
                ],
                [
                  t("Meals booked", "বুক করা মিল"),
                  report.data?.totalMeals || 0,
                  "Billable meal units",
                ],
                [
                  t("Awaiting review", "যাচাইয়ের অপেক্ষায়"),
                  pending,
                  "Deposits and expenses",
                ],
              ].map(([label, value, help]) => (
                <article className="stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{ui(String(help))}</small>
                  {label === t("Awaiting review", "যাচাইয়ের অপেক্ষায়") && (
                    <button
                      onClick={() =>
                        nav("/app/deposits?month=" + month + "&status=pending")
                      }
                    >
                      {t("Review deposits", "জমা যাচাই")}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          {!manager && report.data && (
            <section className="panel">
              <h2>{t("Your balance", "আপনার হিসাব")}</h2>
              <strong>
                {money(
                  Math.abs(
                    report.data.rows.find((x: Row) => x.id === myId)?.due || 0,
                  ),
                )}
              </strong>
              <p>
                {(report.data.rows.find((x: Row) => x.id === myId)?.due || 0) <
                0
                  ? t("Member credit", "ফেরত পাবেন")
                  : t("Amount due", "দিতে হবে")}
              </p>
              <p>
                {t("Verified deposits", "যাচাইকৃত জমা")}:{" "}
                {money(
                  report.data.rows.find((x: Row) => x.id === myId)?.deposits ||
                    0,
                )}
              </p>
            </section>
          )}
          <div className="dashboard-columns">
            <section className="panel">
              <div className="panel-heading">
                <h2>{t("What’s on the table?", "আজকের মেনু")}</h2>
                <CalendarDays size={20} />
              </div>
              <div className="today-menu">
                {["breakfast", "lunch", "dinner"].map((s, i) => {
                  const menu = d.menus.find((m: Row) => m.date === today())?.[
                    s
                  ];
                  return (
                    <div key={s}>
                      <span className="meal-dot">0{i + 1}</span>
                      <div>
                        <strong>{ui(s)}</strong>
                        <p>
                          {menu?.enabled
                            ? menu.menu
                            : menu
                              ? t("Not served", "মিল বন্ধ")
                              : t("Menu not published", "মেনু প্রকাশ হয়নি")}
                        </p>
                      </div>
                      <small>{menu?.serving || "—"}</small>
                    </div>
                  );
                })}
              </div>
              <button className="text-link" onClick={() => setTab("meals")}>
                {ui("Open meal planner")}
                <ArrowUpRight size={16} />
              </button>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>{t("Bazar duty", "বাজারের পালা")}</h2>
                <ShoppingBasket size={20} />
              </div>
              {d.duties
                .filter(
                  (x: Row) => x.date >= today() && x.status !== "completed",
                )
                .slice(0, 4)
                .map((x: Row) => (
                  <div className="duty-item" key={x.id}>
                    <span className="avatar">
                      {name(x.memberId).slice(0, 1)}
                    </span>
                    <div>
                      <strong>{name(x.memberId)}</strong>
                      <p>{x.items}</p>
                      <small>{x.date}</small>
                    </div>
                  </div>
                ))}
              {!d.duties.some(
                (x: Row) => x.date >= today() && x.status !== "completed",
              ) && (
                <div className="empty">
                  {ui("No upcoming bazar assignments.")}
                </div>
              )}
              <button className="text-link" onClick={() => setTab("bazar")}>
                {ui("View bazar board")}
                <ChevronRight size={16} />
              </button>
            </section>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>{t("Latest notices", "সাম্প্রতিক নোটিশ")}</h2>
              <button className="text-link" onClick={() => setTab("notices")}>
                {ui("View all")}
              </button>
            </div>
            {d.notices.slice(0, 2).map((n: Row) => (
              <article className="notice" key={n.id}>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>
                  {n.author} · {new Date(n.at).toLocaleDateString()}
                </small>
              </article>
            ))}
            {!d.notices.length && (
              <p className="muted">
                {ui("Your manager’s announcements will appear here.")}
              </p>
            )}
          </section>
        </>
      );
    if (tab === "deposits")
      return (
        <>
          <div className="section-toolbar">
            <div>
              <h2>
                {t("Contributions to the mess fund", "মেস ফান্ডে টাকা জমা")}
              </h2>
              <p>
                {t(
                  "Mobile wallet submissions and hand-to-hand cash, in one record.",
                  "মোবাইল ব্যাংকিং ও হাতে দেওয়া নগদ—একই খাতায়।",
                )}
              </p>
            </div>
            {manager &&
              button(
                "Record cash",
                () =>
                  open("Cash received", "deposit_cash", [
                    memberAll,
                    dateField,
                    amountField,
                    { ...f("note", "Reference / note"), optional: true },
                  ]),
                true,
              )}
          </div>
          <div className="summary-strip">
            {["pending", "approved", "rejected", "voided"].map((status) => (
              <span key={status}>
                {ui(status)}:{" "}
                <strong>
                  {money(
                    allDeposits
                      .filter((x: Row) => x.status === status)
                      .reduce((n: number, x: Row) => n + x.amount, 0),
                  )}
                </strong>
              </span>
            ))}
            <span>
              {t("Refunded", "ফেরত দেওয়া")}:{" "}
              {money(
                d.transfers
                  .filter(
                    (x: Row) => x.type === "refund" && x.date.startsWith(month),
                  )
                  .reduce((n: number, x: Row) => n + x.amount, 0),
              )}
            </span>
          </div>
          <Filters
            fields={[
              [
                "provider",
                t("Provider", "মাধ্যম"),
                ["bKash", "Nagad", "Rocket", "cash"].map((x) => [x, x]),
              ],
              [
                "member",
                t("Member", "সদস্য"),
                members.map((x: Row) => [x.id, name(x.id)]),
              ],
            ]}
          />
          <div className="wallet-grid">
            {["bKash", "Nagad", "Rocket"].map((provider) => {
              const account = d.accounts.find(
                (x: Row) => x.provider === provider,
              );
              return (
                <article
                  className={"wallet-card " + provider.toLowerCase()}
                  key={provider}
                >
                  <h3>{provider}</h3>
                  <strong>
                    {account?.enabled ? account.number : ui("Not configured")}
                  </strong>
                  <p>
                    {account?.enabled
                      ? account.name
                      : ui("Manager setup required")}
                  </p>
                  <small>
                    {account?.enabled
                      ? account.instructions
                      : ui(
                          "Do not send money before a receiving account is configured.",
                        )}
                  </small>
                  {account?.qr && (
                    <a
                      href={`/api/messes/${active}/files/${account.qr.split("/")[1]}`}
                    >
                      {ui("Download official QR")}
                    </a>
                  )}
                  {account?.enabled && (
                    <button
                      onClick={() =>
                        navigator.clipboard
                          .writeText(account.number)
                          .then(() =>
                            setNotice(t("Number copied", "নম্বর কপি হয়েছে")),
                          )
                          .catch(() =>
                            setError(
                              t(
                                "Copy unavailable. Select the number manually.",
                                "নম্বরটি নিজে কপি করুন।",
                              ),
                            ),
                          )
                      }
                    >
                      {t("Copy number", "নম্বর কপি")}
                    </button>
                  )}
                  <div className="row-actions">
                    <button
                      className="button dark"
                      disabled={!account?.enabled || busy}
                      onClick={() =>
                        open(
                          "Submit mobile deposit",
                          "deposit_submit",
                          [
                            memberField(),
                            dateField,
                            amountField,
                            f("transactionId", "Transaction ID"),
                            { ...f("note", "Note"), optional: true },
                          ],
                          {
                            preset: { provider },
                            info: t(
                              `Send using ${provider} to ${account.name} (${account.number}). Submit only after sending. Never enter PIN or OTP.`,
                              `${provider} দিয়ে ${account.name} (${account.number})-এ টাকা পাঠিয়ে reference দিন। PIN বা OTP দেবেন না।`,
                            ),
                          },
                        )
                      }
                    >
                      {ui("Submit deposit")}
                    </button>
                    {manager &&
                      button("Configure", () =>
                        open(
                          "Receiving account",
                          "account",
                          [
                            f(
                              "number",
                              "Receiving number",
                              "tel",
                              account?.number,
                            ),
                            f("name", "Account holder", "text", account?.name),
                            f(
                              "instructions",
                              "Send Money / Payment instructions",
                              "textarea",
                              account?.instructions,
                            ),
                            f(
                              "enabled",
                              "Enable this method",
                              "checkbox",
                              account?.enabled || false,
                            ),
                            {
                              name: "qr",
                              label: "Official QR image (optional)",
                              type: "file",
                              optional: true,
                            },
                          ],
                          {
                            preset: {
                              provider,
                              ...(account?.qr ? { qr: account.qr } : {}),
                            },
                          },
                        ),
                      )}
                  </div>
                </article>
              );
            })}
          </div>
          <p className="callout">
            <ShieldIcon />
            {t(
              "Wallet deposits change the balance only after manager confirmation. Decisions appear in the app and are emailed to verified members. Accepted means the provider accepted the message; it is not a delivery receipt.",
              "ম্যানেজারের অনুমোদনের পরেই মোবাইল ব্যাংকিংয়ের জমা হিসাবে যুক্ত হবে। সিদ্ধান্ত অ্যাপে দেখা যাবে এবং যাচাইকৃত সদস্যকে ইমেইলে জানানো হবে। প্রদানকারী গ্রহণ করেছে মানেই বার্তা পৌঁছানোর প্রমাণ নয়।",
            )}
          </p>
          <section className="panel">
            <div className="section-toolbar">
              <div className="filters">
                <input
                  aria-label={ui("Search deposits")}
                  placeholder={t(
                    "Search member or transaction",
                    "সদস্য বা লেনদেন খুঁজুন",
                  )}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label={ui("Deposit status")}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {["all", "pending", "approved", "rejected", "voided"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {ui(x)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {button("Export CSV", () =>
                csv("deposits-" + month, [
                  ["Member", "Provider", "Date", "Reference", "BDT", "Status"],
                  ...deposits.map((x: Row) => [
                    name(x.memberId),
                    x.provider,
                    x.date,
                    x.transactionId || "cash",
                    (x.amount / 100).toFixed(2),
                    x.status,
                  ]),
                ]),
              )}
            </div>
            <Table
              headers={[
                "Member",
                "Method / reference",
                "Amount",
                "Status",
                "Review",
              ]}
              rows={deposits
                .filter(
                  (x: Row) =>
                    (status === "all" || x.status === status) &&
                    (name(x.memberId) + " " + (x.transactionId || ""))
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .slice()
                .reverse()
                .map((x: Row) => [
                  <>
                    <strong>{name(x.memberId)}</strong>
                    <small>{x.date}</small>
                  </>,
                  <>
                    {x.provider}
                    <small>
                      {x.transactionId || ui("Cash handed to manager")}
                    </small>
                    <small>{x.recipient}</small>
                  </>,
                  money(x.amount),
                  <Status s={x.status} />,
                  <>
                    <details>
                      <summary>{t("Details", "বিস্তারিত")}</summary>
                      <p>
                        {t("Submitted", "জমা দেওয়া")}:{" "}
                        {new Date(x.submittedAt).toLocaleString(
                          bn ? "bn-BD" : "en-GB",
                          { timeZone: "Asia/Dhaka" },
                        )}
                      </p>
                      <p>
                        {t("Reviewed by", "যাচাই করেছেন")}:{" "}
                        {members.find((m: Row) => m.userId === x.reviewedBy)
                          ?.email || "—"}
                      </p>
                      <p>{x.note}</p>
                      {d.audit
                        .filter((a: Row) => a.description?.includes(x.id))
                        .map((a: Row) => (
                          <p key={a.id}>{a.description}</p>
                        ))}
                    </details>
                    {x.reason && <small>{x.reason}</small>}
                    {x.reviewedAt && (
                      <small>
                        {new Date(x.reviewedAt).toLocaleString("en-GB", {
                          timeZone: "Asia/Dhaka",
                        })}
                      </small>
                    )}
                    {manager &&
                      x.status === "pending" &&
                      rowReview("deposit_review", x.id)}
                    {manager &&
                      x.status === "approved" &&
                      button("Void", () =>
                        open(
                          "Void incorrect deposit",
                          "deposit_void",
                          [reason],
                          {
                            preset: { id: x.id },
                            info: "This is an accounting reversal, not a refund. Record an actual cash refund separately.",
                          },
                        ),
                      )}
                  </>,
                ])}
            />
          </section>
          {manager && (
            <section className="panel">
              <h2>
                {t("Email & notification history", "ইমেইল ও বিজ্ঞপ্তির ইতিহাস")}
              </h2>
              <Table
                headers={[
                  "Member",
                  t("Channel", "মাধ্যম"),
                  "Status",
                  "Created",
                ]}
                rows={d.outbox.map((x: Row) => [
                  name(x.memberId),
                  x.channel === "email" ? t("Email", "ইমেইল") : "SMS",
                  <Status s={x.status} />,
                  <>
                    {new Date(x.at).toLocaleString()}
                    <p>{x.resolution}</p>
                    {admin &&
                      ["unknown", "sending"].includes(x.status) &&
                      !x.resolvedAt && (
                        <button
                          onClick={() =>
                            open(
                              "Reconcile notification",
                              "notification_reconcile",
                              [reason],
                              {
                                preset: { id: x.id },
                                info: "Check provider logs first. This records your finding; it does not resend or claim delivery.",
                              },
                            )
                          }
                        >
                          {t("Reconcile", "যাচাইয়ের ফল লিখুন")}
                        </button>
                      )}
                  </>,
                ])}
                empty={t(
                  "No notifications queued yet.",
                  "এখনো কোনো বিজ্ঞপ্তি সারিতে নেই।",
                )}
              />
              <p className="muted">
                {ui(
                  "Queued messages remain queued until a real provider is configured. Unknown/sending states require operator reconciliation; they are not automatically resent.",
                )}
              </p>
            </section>
          )}
        </>
      );
    if (tab === "meals") {
      const plan = d.menus.find((m: Row) => m.date === date);
      return (
        <>
          <div className="section-toolbar">
            <input
              aria-label={ui("Meal date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || today())}
            />
            <div className="row-actions">
              {button("Turn on / off", () => mealForm(), true)}
              {button("Weekly preferences", () => mealForm(true))}
              {manager &&
                button("Publish menu", () =>
                  open(
                    "Daily menu",
                    "menu",
                    [
                      ...["breakfast", "lunch", "dinner"].flatMap((s, i) => [
                        f(
                          s + "Enabled",
                          s + " served",
                          "checkbox",
                          plan?.[s].enabled ?? true,
                        ),
                        {
                          ...f(
                            s + "Menu",
                            s + " menu",
                            "text",
                            plan?.[s].menu || "",
                          ),
                          optional: true,
                        },
                        f(
                          s + "Cutoff",
                          s + " cutoff",
                          "time",
                          plan?.[s].cutoff || ["07:00", "10:00", "16:00"][i],
                        ),
                        f(
                          s + "Serving",
                          s + " serving",
                          "time",
                          plan?.[s].serving || ["08:00", "13:00", "20:00"][i],
                        ),
                      ]),
                    ],
                    {
                      preset: { date },
                      transform: (p) => ({
                        date,
                        ...Object.fromEntries(
                          ["breakfast", "lunch", "dinner"].map((s) => [
                            s,
                            {
                              enabled: p[s + "Enabled"],
                              menu: p[s + "Menu"],
                              cutoff: p[s + "Cutoff"],
                              serving: p[s + "Serving"],
                            },
                          ]),
                        ),
                      }),
                    },
                  ),
                )}
            </div>
          </div>
          <div
            className="week-strip"
            aria-label={t("Seven day planner", "সাত দিনের মিল")}
          >
            {Array.from({ length: 7 }, (_, i) => {
              const day = new Date(Date.parse(date) + i * 86400000)
                .toISOString()
                .slice(0, 10);
              const meal = d.meals.find(
                (x: Row) => x.memberId === myId && x.date === day,
              );
              return (
                <button key={day} onClick={() => setDate(day)}>
                  <strong>{day}</strong>
                  <span>
                    {["breakfast", "lunch", "dinner"]
                      .map((k) => (meal?.[k] || 0) / 2)
                      .join(" / ")}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="meal-cards">
            {["breakfast", "lunch", "dinner"].map((s, i) => (
              <article key={s}>
                <span className="meal-number">0{i + 1}</span>
                <Status
                  s={
                    plan
                      ? plan[s].enabled
                        ? "Serving"
                        : "Not served"
                      : "Unpublished"
                  }
                />
                <h2>{ui(s)}</h2>
                <p>
                  {plan?.[s].menu || ui("Manager has not published the menu.")}
                </p>
                <p>
                  {t("Your booking", "আপনার মিল")}:{" "}
                  {(d.meals.find(
                    (x: Row) => x.memberId === myId && x.date === date,
                  )?.[s] || 0) / 2}
                </p>
                <div>
                  <span>
                    {ui("Deadline")}:{" "}
                    {plan?.[s].cutoff ||
                      t("Menu setup required", "মেনু সেটআপ প্রয়োজন")}
                    <br />
                    {t("Serving", "পরিবেশন")}: {plan?.[s].serving || "—"}
                    <br />
                    {plan?.[s].enabled
                      ? date > today() ||
                        (date === today() &&
                          new Intl.DateTimeFormat("en-GB", {
                            timeZone: "Asia/Dhaka",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date()) < plan[s].cutoff)
                        ? t("Booking open", "বুকিং চলছে")
                        : t("Deadline passed", "সময় শেষ")
                      : t("Service unavailable", "খাবার চালু নেই")}
                  </span>
                  <strong>
                    {d.meals
                      .filter((m: Row) => m.date === date)
                      .reduce((sum: number, m: Row) => sum + (m[s] || 0), 0) /
                      2}{" "}
                    {ui("portions")}
                  </strong>
                </div>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>{ui("Daily register")}</h2>
            <Table
              headers={["Member", "Breakfast", "Lunch", "Dinner"]}
              rows={members
                .filter(
                  (m: Row) => m.joined <= date && (!m.left || m.left >= date),
                )
                .map((m: Row) => {
                  const r = d.meals.find(
                    (x: Row) => x.memberId === m.id && x.date === date,
                  );
                  return [
                    name(m.id),
                    ...["breakfast", "lunch", "dinner"].map(
                      (s) => (r?.[s] || 0) / 2,
                    ),
                  ];
                })}
            />
            <p className="muted">
              {ui(
                "Times use Asia/Dhaka. Half meals and guest portions follow your mess's effective rules.",
              )}
            </p>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>{ui("Correction requests")}</h2>
              {button("Request correction", () =>
                open(
                  "Meal correction request",
                  "correction_request",
                  [
                    memberField(),
                    dateField,
                    ...["breakfast", "lunch", "dinner"].map((s) =>
                      f(s, s, "meal", 0),
                    ),
                    reason,
                  ],
                  {
                    transform: (p) => ({
                      ...p,
                      counts: {
                        breakfast: p.breakfast,
                        lunch: p.lunch,
                        dinner: p.dinner,
                      },
                    }),
                  },
                ),
              )}
            </div>
            <Table
              headers={["Member", "Date", "Reason", "Status", "Action"]}
              rows={d.corrections.map((r: Row) => [
                name(r.memberId),
                r.date,
                r.reason,
                <Status s={r.status} />,
                manager && r.status === "pending"
                  ? button("Review", () =>
                      open(
                        "Review correction",
                        "correction_review",
                        [
                          f(
                            "approve",
                            "Approve requested counts",
                            "checkbox",
                            false,
                          ),
                          reason,
                        ],
                        { preset: { id: r.id } },
                      ),
                    )
                  : r.reviewNote,
              ])}
            />
          </section>
        </>
      );
    }
    if (tab === "bazar")
      return (
        <>
          <div className="section-toolbar">
            <h2>{ui("Bazar & household expenses")}</h2>
            <div className="row-actions">
              {button("Add expense", expenseForm, true)}
              {manager &&
                button("Assign bazar", () =>
                  open("Bazar duty", "duty", [
                    memberAll,
                    dateField,
                    f("items", "Shopping list", "textarea"),
                  ]),
                )}
              {manager &&
                button("Issue advance", () =>
                  open("Bazar advance handed out", "advance", [
                    memberAll,
                    dateField,
                    amountField,
                    f("note", "Reference"),
                  ]),
                )}
            </div>
          </div>
          <Filters
            fields={[
              [
                "expenseStatus",
                t("Status", "অবস্থা"),
                ["pending", "approved", "rejected"].map((x) => [x, ui(x)]),
              ],
              [
                "category",
                t("Category", "খাত"),
                [...new Set(allExpenses.map((x: Row) => x.category))].map(
                  (x) => [String(x), ui(String(x))],
                ),
              ],
              [
                "purchaser",
                t("Purchaser", "ক্রেতা"),
                members.map((x: Row) => [x.id, name(x.id)]),
              ],
              [
                "source",
                t("Source", "অর্থের উৎস"),
                ["fund", "personal", "advance"].map((x) => [x, ui(x)]),
              ],
            ]}
          />
          <section className="panel">
            <h2>{ui("Bazar board")}</h2>
            <Table
              headers={["Who / when", "Shopping list", "Status", "Action"]}
              rows={d.duties
                .slice()
                .reverse()
                .map((x: Row) => [
                  <>
                    {name(x.memberId)}
                    <small>{x.date}</small>
                  </>,
                  x.items,
                  <Status s={x.status} />,
                  x.status !== "completed" && (manager || x.memberId === myId)
                    ? button("Complete", () =>
                        run("duty_complete", { id: x.id }),
                      )
                    : null,
                ])}
            />
          </section>
          <section className="panel">
            <h2>{ui("Advances")}</h2>
            <Table
              headers={[
                "Member",
                "Issued",
                "Used / reserved",
                "Returned",
                "Action",
              ]}
              rows={d.advances.map((x: Row) => [
                name(x.memberId),
                money(x.amount),
                money(
                  d.expenses
                    .filter(
                      (e: Row) =>
                        e.advanceId === x.id && e.status !== "rejected",
                    )
                    .reduce((s: number, e: Row) => s + e.amount, 0),
                ),
                money(x.returns.reduce((s: number, r: Row) => s + r.amount, 0)),
                manager
                  ? button("Record return", () =>
                      open(
                        "Unspent advance returned",
                        "advance_return",
                        [dateField, amountField],
                        { preset: { id: x.id } },
                      ),
                    )
                  : null,
              ])}
            />
          </section>
          <section className="panel">
            <h2>{ui("Expenses")}</h2>
            <Table
              headers={[
                "Purchase",
                "Payer / source",
                "Amount",
                "Status",
                "Review",
              ]}
              rows={expenses
                .slice()
                .reverse()
                .map((x: Row) => [
                  <>
                    <strong>{x.title}</strong>
                    <small>
                      {x.date} · {x.category} · {x.split}
                    </small>
                    <details>
                      <summary>{t("Purchase details", "ক্রয়ের বিবরণ")}</summary>
                      <p>
                        {t("Advance", "অগ্রিম")}:{" "}
                        {x.advanceId
                          ? money(
                              d.advances.find((a: Row) => a.id === x.advanceId)
                                ?.amount || 0,
                            )
                          : "—"}
                      </p>
                      {x.items?.map((item: Row, i: number) => (
                        <p key={i}>
                          {item.name} · {item.quantity} {item.unit} ·{" "}
                          {money(item.paisa || 0)}
                        </p>
                      ))}
                    </details>
                    {x.receipt && (
                      <a
                        href={`/api/messes/${active}/files/${x.receipt.split("/")[1]}`}
                      >
                        {ui("Private receipt")}
                      </a>
                    )}
                  </>,
                  <>
                    {name(x.paidBy)}
                    <small>{x.source}</small>
                  </>,
                  money(x.amount),
                  <Status s={x.status} />,
                  <>
                    {manager && x.status === "pending"
                      ? rowReview("expense_review", x.id)
                      : x.reviewNote}
                    {x.question && (
                      <small>
                        {ui("Question:")}
                        {x.question}
                      </small>
                    )}
                    {x.resolution && (
                      <small>
                        {ui("Resolution:")}
                        {x.resolution}
                      </small>
                    )}
                    {!d.closed[month] &&
                      (!x.question || x.resolution) &&
                      button("Question", () =>
                        open(
                          "Question this expense",
                          "expense_question",
                          [reason],
                          { preset: { id: x.id } },
                        ),
                      )}
                    {manager &&
                      x.question &&
                      !x.resolution &&
                      button("Resolve", () =>
                        open(
                          "Resolve expense question",
                          "expense_resolve",
                          [reason],
                          { preset: { id: x.id } },
                        ),
                      )}
                  </>,
                ])}
            />
          </section>
        </>
      );
    if (tab === "members")
      return (
        <>
          <div className="section-toolbar">
            <h2>{t("The people around your table", "আপনার মেসের মানুষ")}</h2>
            <div className="row-actions">
              {admin &&
                button(
                  "Invite member",
                  () =>
                    open(
                      "Invite a verified email",
                      "",
                      [f("email", "Email", "email")],
                      { endpoint: `/messes/${active}/invites` },
                    ),
                  true,
                )}
              {admin &&
                button("Assign manager", () =>
                  open(
                    "Manager handover",
                    "manager",
                    [memberAll, f("month", "Management month", "month", month)],
                    {
                      info: "An audit snapshot records cash, pending entries and stock at handover.",
                    },
                  ),
                )}
            </div>
          </div>
          {admin && (
            <InvitationList
              active={active!}
              invites={d.invites}
              refresh={refresh}
              onLink={setNotice}
            />
          )}
          <div className="members-grid">
            {members.map((m: Row) => (
              <article className="panel member-card" key={m.id}>
                <span className="avatar large">{m.name.slice(0, 1)}</span>
                <h3>{m.name}</h3>
                <p>{m.email}</p>
                <Status
                  s={
                    m.left && m.left < today()
                      ? "Inactive"
                      : m.userId === state.data.adminId
                        ? "Admin"
                        : d.managers[month] === m.id
                          ? "Manager"
                          : "Member"
                  }
                />
                {m.userId === state.data.adminId &&
                  d.managers[month] === m.id && <Status s="Manager" />}
                <small>
                  {ui("Joined")} {m.joined}
                  {m.left ? " · Left " + m.left : ""}
                </small>
                {admin &&
                  m.userId !== user.id &&
                  button("Record departure", () =>
                    open(
                      "Member departure",
                      "member_leave",
                      [dateField, reason],
                      { preset: { memberId: m.id } },
                    ),
                  )}
              </article>
            ))}
          </div>
        </>
      );
    if (tab === "settlement") {
      const r = report.data;
      return (
        <>
          <div className="section-toolbar">
            <div>
              <h2>
                {month} {t("statement", "হিসাব")}
              </h2>
              <p>
                {ui(
                  "Opening + allocated costs − deposits − personal purchases + actual payouts",
                )}
              </p>
            </div>
            <div className="row-actions">
              {button(
                "Print / save PDF",
                () => window.print(),
                false,
                !r || report.isError,
              )}
              {button("CSV", () =>
                csv("settlement-" + month, [
                  [
                    "Month",
                    month,
                    "Generated",
                    new Date().toISOString(),
                    "Version",
                    d.closed[month]?.version || "live",
                  ],
                  [
                    "Name",
                    "Meals",
                    "Opening BDT",
                    "Cost BDT",
                    "Deposits BDT",
                    "Personal BDT",
                    "Payouts BDT",
                    "Due BDT",
                  ],
                  ...(r?.rows || [])
                    .filter(
                      (x: Row) =>
                        !params.get("statementMember") ||
                        x.id === params.get("statementMember"),
                    )
                    .map((x: Row) => [
                      name(x.id),
                      x.meals,
                      ...[
                        x.opening,
                        x.cost,
                        x.deposits,
                        x.personal,
                        x.payouts,
                        x.due,
                      ].map((v) => (v / 100).toFixed(2)),
                    ]),
                ]),
              )}
              {admin &&
                d.closed[month] &&
                !d.closed[month].legacy &&
                button("Reopen with reason", () =>
                  open("Reopen latest finalized month", "reopen", [reason], {
                    preset: { month },
                    info: "The old snapshot is preserved. Later month calculations are suspended until this month is finalized again.",
                  }),
                )}
              {manager &&
                !d.closed[month] &&
                button(
                  "Finalize",
                  () =>
                    open(
                      "Finalize completed month",
                      "close",
                      [
                        f(
                          "confirm",
                          "I reviewed all records and understand the month will be locked",
                          "checkbox",
                          false,
                        ),
                      ],
                      {
                        preset: { month },
                        transform: (p) => {
                          if (!p.confirm)
                            throw Error("Confirm the review first");
                          return p;
                        },
                      },
                    ),
                  true,
                  month >= today().slice(0, 7) ||
                    report.isPending ||
                    report.isError ||
                    pending > 0,
                )}
            </div>
          </div>
          <p>
            {t(
              "Close completed months only. Resolve pending deposits, expenses, corrections and advances first.",
              "শুধু শেষ হওয়া মাস বন্ধ করুন। জমা, খরচ, সংশোধন ও অগ্রিম আগে মেলান।",
            )}
          </p>
          <p>
            {t("Generated", "তৈরির সময়")}:{" "}
            {new Date().toLocaleString(bn ? "bn-BD" : "en-GB", {
              timeZone: "Asia/Dhaka",
            })}{" "}
            · {t("Policy", "নিয়ম")}:{" "}
            {d.rules.filter((x: Row) => x.effective <= month).at(-1)?.effective}
          </p>
          {report.isPending && (
            <p role="status">{t("Loading statement…", "হিসাব আসছে…")}</p>
          )}
          {report.error && (
            <p className="error" role="alert">
              {report.error.message}
              <button onClick={() => report.refetch()}>{ui("Retry")}</button>
            </p>
          )}
          {r && (
            <SettlementSummary
              data={d}
              report={r}
              month={month}
              memberName={name}
            />
          )}
          {r?.unallocated > 0 && (
            <p className="error">
              {money(r.unallocated)} cannot be allocated. Check meal counts and
              eligible members before closing.
            </p>
          )}
          <section className="panel">
            <Status
              s={
                d.closed[month]
                  ? "Finalized · v" + (d.closed[month].version || 1)
                  : d.reopened?.[month]
                    ? "Reopened for correction"
                    : "Live estimate"
              }
            />
            {(d.versions?.[month] || []).map((v: Row, i: number) => (
              <details key={i}>
                <summary>
                  {ui("Preserved version")}
                  {v.version || i + 1} · {v.at}
                </summary>
                <Table
                  headers={["Member", "Due / credit"]}
                  rows={v.rows.map((x: Row) => [x.name, money(x.due)])}
                />
              </details>
            ))}
            <Table
              headers={[
                "Member",
                "Meals",
                "Opening",
                "Costs",
                "Deposits",
                "Personal",
                "Payouts",
                "Due / credit",
              ]}
              rows={(r?.rows || [])
                .filter(
                  (x: Row) =>
                    !params.get("statementMember") ||
                    x.id === params.get("statementMember"),
                )
                .map((x: Row) => [
                  name(x.id),
                  x.meals,
                  ...[x.opening, x.cost, x.deposits, x.personal, x.payouts].map(
                    (v) => money(v),
                  ),
                  <strong className={x.due > 0 ? "owed" : "credit"}>
                    {money(Math.abs(x.due))}{" "}
                    {x.due < 0
                      ? t("credit", "ফেরত পাবেন")
                      : x.due > 0
                        ? t("due", "দিতে হবে")
                        : t("settled", "হিসাব সমান")}
                  </strong>,
                ])}
            />
            <p className="muted">
              {ui(
                "Positive = due. Negative = member credit. Finalized balances carry forward once. Stock is quantity-only and does not deduct expenses again.",
              )}
            </p>
          </section>
          {manager && (
            <section className="panel">
              <h2>{ui("Actual cash paid back")}</h2>
              {button("Record refund / reimbursement", () =>
                open("Money actually paid to member", "transfer", [
                  memberAll,
                  dateField,
                  amountField,
                  {
                    name: "type",
                    label: "Type",
                    options: [
                      ["refund", "Return member credit"],
                      ["reimbursement", "Reimburse personal purchase"],
                    ],
                  },
                  f("note", "Reference"),
                ]),
              )}
              <Table
                headers={["Member", "Date", "Type", "Amount"]}
                rows={d.transfers
                  .filter((x: Row) => x.date.startsWith(month))
                  .map((x: Row) => [
                    name(x.memberId),
                    x.date,
                    x.type,
                    money(x.amount),
                  ])}
              />
            </section>
          )}
        </>
      );
    }
    if (tab === "stock")
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{ui("Kitchen stock")}</h2>
              <p>
                {ui(
                  "Quantity ledger. Purchase costs are recorded only in Expenses.",
                )}
              </p>
            </div>
            {manager &&
              button(
                "Stock movement",
                () =>
                  open("Record stock in / out", "stock", [
                    dateField,
                    f("name", "Item"),
                    f("unit", "Unit (kg / litre / packet)"),
                    f("quantity", "Quantity (+ received / − used)", "signed"),
                    f("note", "Reason / opening count"),
                  ]),
                true,
              )}
          </div>
          <Table
            headers={["Date", "Item", "Quantity", "Note"]}
            rows={d.stock
              .slice()
              .reverse()
              .map((x: Row) => [
                x.date,
                x.name,
                `${x.quantity} ${x.unit}`,
                x.note,
              ])}
          />
          <StockSummary
            data={d}
            month={month}
            manager={manager}
            onThreshold={() =>
              open("Low stock threshold", "stock_threshold", [
                f("name", "Item"),
                f("unit", "Unit (kg / litre / packet)"),
                f("minimum", "Minimum quantity", "number"),
              ])
            }
          />
          <h3>{ui("Current quantities")}</h3>
          {Object.entries(
            d.stock.reduce(
              (a: Row, x: Row) => ({
                ...a,
                [x.name + " (" + x.unit + ")"]:
                  (a[x.name + " (" + x.unit + ")"] || 0) + x.quantity,
              }),
              {},
            ),
          ).map(([key, value]) => (
            <p key={key}>
              {key}: {String(value)}
            </p>
          ))}
        </section>
      );
    if (tab === "notices")
      return (
        <>
          <div className="section-toolbar">
            <h2>{ui("Notice board")}</h2>
            {manager &&
              button(
                "Post notice",
                () =>
                  open("New notice", "notice", [
                    f("title", "Title"),
                    f("body", "Announcement", "textarea"),
                  ]),
                true,
              )}
          </div>
          {d.notices.map((x: Row) => (
            <article className="panel notice" key={x.id}>
              <h2>{x.title}</h2>
              <p>{x.body}</p>
              <small>
                {x.author} · {new Date(x.at).toLocaleString()}
              </small>
            </article>
          ))}
          <section className="panel">
            <h2>{ui("Your notifications")}</h2>
            <button
              disabled={busy || !d.notifications.some((x: Row) => !x.read)}
              onClick={() => run("read_all_notifications", {})}
            >
              {t("Mark all read", "সব পড়া হয়েছে")}
            </button>
            {d.notifications
              .slice()
              .reverse()
              .map((x: Row) => (
                <div className="notification" key={x.id}>
                  <p>
                    {x.message}
                    {x.target && (
                      <Link to={"/app/" + x.target}>
                        {t("View record", "বিস্তারিত দেখুন")}
                      </Link>
                    )}
                    <small>{new Date(x.at).toLocaleString()}</small>
                  </p>
                  {!x.read &&
                    button("Mark read", () =>
                      run("read_notification", { id: x.id }),
                    )}
                </div>
              ))}
            {!d.notifications.length && <p>{ui("No notifications yet.")}</p>}
          </section>
        </>
      );
    if (tab === "activity")
      return (
        <section className="panel">
          <h2>{ui("Activity & handover history")}</h2>
          <Table
            headers={["Time (Dhaka)", "Who", "Action", "Details"]}
            rows={d.audit
              .slice()
              .reverse()
              .map((x: Row) => [
                new Date(x.at).toLocaleString("en-GB", {
                  timeZone: "Asia/Dhaka",
                }),
                x.name || x.actor,
                ui(x.action),
                <details>
                  <summary>
                    {ui(x.action)} · {t("Details", "বিস্তারিত")}
                  </summary>
                  <p>{x.description}</p>
                  {x.before && (
                    <p>
                      {t("Previous records", "আগের রেকর্ড")}: {x.before.length}{" "}
                      → {x.after?.length}
                    </p>
                  )}
                </details>,
              ])}
          />
        </section>
      );
    return (
      <>
        <section className="panel">
          <h2>{t("Profile & notifications", "প্রোফাইল ও বিজ্ঞপ্তি")}</h2>
          <p>
            {t(
              "Deposit decisions appear in your app and are emailed to your verified address. SMS is not enabled on this deployment.",
              "জমার সিদ্ধান্ত অ্যাপে দেখা যাবে এবং আপনার যাচাইকৃত ইমেইলে পাঠানো হবে। এই সাইটে এখন এসএমএস চালু নেই।",
            )}
          </p>
          {button("Edit profile", () =>
            open(
              "Profile",
              "",
              [
                f("name", "Name", "text", user.name),
                ...(state.data?.services?.sms
                  ? [
                      {
                        ...f(
                          "phone",
                          "Bangladesh phone (+8801...)",
                          "tel",
                          user.phone,
                        ),
                        optional: true,
                      },
                      f(
                        "smsConsent",
                        "Send me transactional deposit confirmation SMS",
                        "checkbox",
                        user.smsConsent,
                      ),
                    ]
                  : []),
              ],
              {
                endpoint: "/me",
                preset: {
                  phone: user.phone || "",
                  smsConsent: !!user.smsConsent,
                },
              },
            ),
          )}
        </section>
        {admin && (
          <section className="panel">
            <h2>{ui("Mess settings")}</h2>
            <div className="row-actions">
              {button("Edit mess", () =>
                open("Mess profile", "settings", [
                  f("name", "Name", "text", d.name),
                  {
                    ...f("location", "Location", "text", d.location),
                    optional: true,
                  },
                ]),
              )}
              {button("New effective rules", () =>
                open("Rules for an unused future month", "rules", [
                  f("effective", "Effective month", "month", month),
                  f(
                    "weights",
                    "Integer weights for breakfast, lunch, dinner",
                    "json",
                    JSON.stringify(d.rules.at(-1).weights),
                  ),
                  f(
                    "half",
                    "Allow half meals",
                    "checkbox",
                    d.rules.at(-1).half,
                  ),
                  f(
                    "guests",
                    "Allow guest portions",
                    "checkbox",
                    d.rules.at(-1).guests,
                  ),
                  f(
                    "categories",
                    "Category → meal/equal/occupancy/fixed",
                    "json",
                    JSON.stringify(d.rules.at(-1).categories),
                  ),
                ]),
              )}
              <a
                className="button outline"
                href={`/api/messes/${active}/export`}
              >
                {ui("Download private data backup")}
              </a>
            </div>
            <p className="muted">
              {ui(
                "Finalized months cannot be silently reopened. Keep exported backups private. Current policy: confirmed bookings are billable; stock quantities do not change the meal rate.",
              )}
            </p>
            {d.rules.map((rule: Row) => (
              <details key={rule.effective}>
                <summary>
                  {ui("Effective month")}: {rule.effective}
                </summary>
                <Table
                  headers={[ui("Category"), t("Allocation", "ভাগের নিয়ম")]}
                  rows={Object.entries(rule.categories).map(
                    ([category, allocation]) => [
                      ui(category),
                      ui(String(allocation)),
                    ],
                  )}
                />
                <p>
                  {["breakfast", "lunch", "dinner"]
                    .map((slot) => `${ui(slot)}: ${rule.weights[slot]}`)
                    .join(" · ")}
                </p>
              </details>
            ))}
          </section>
        )}
      </>
    );
  };
  return (
    <div className="app-shell">
      <aside
        inert={mobile && !drawer}
        className={"sidebar " + (drawer ? "open" : "")}
      >
        <div className="sidebar-brand">
          <Brand to="/app/overview" />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          >
            <X />
          </button>
        </div>
        <div className="mess-selector">
          <span className="eyebrow">{ui("YOUR HOUSEHOLD")}</span>
          <select
            aria-label={ui("Switch mess")}
            value={active || ""}
            onChange={(e) => {
              setMess(e.target.value);
              localStorage.setItem("activeMess", e.target.value);
              setDrawer(false);
            }}
          >
            <option value="" disabled>
              {ui("Select mess")}
            </option>
            {messes.data?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <button
            className="text-link"
            onClick={() =>
              open("Create another mess", "", [f("name", "Mess name")], {
                endpoint: "/messes",
              })
            }
          >
            <Plus size={14} />
            {ui("New mess")}
          </button>
        </div>
        <nav>
          {navs.map(([id, en, b, Icon]) => (
            <button
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                setTab(id);
                setDrawer(false);
              }}
            >
              <Icon size={19} />
              {t(en, b)}
              {id === "deposits" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.name?.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{state.data?.role || "Member"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              await api("/logout", {});
              qc.clear();
              nav("/login");
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {drawer && (
        <button
          className="drawer-scrim"
          aria-label="Close menu overlay"
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="app-main" inert={mobile && drawer}>
        <header className="app-topbar">
          <div>
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <Menu />
            </button>
            <span className="muted">{ui("Workspace")}</span>
            <ChevronRight size={14} />
            <strong>
              {t(
                navs.find((x) => x[0] === tab)?.[1] || "",
                navs.find((x) => x[0] === tab)?.[2] || "",
              )}
            </strong>
          </div>
          <div>
            <button className="language" onClick={toggle}>
              {bn ? "English" : "বাংলা"}
            </button>
            <button
              className="icon-button"
              aria-label={ui("Notifications")}
              onClick={() => setTab("notices")}
            >
              <Bell size={20} />
              <span className="nav-count">
                {d?.notifications.filter((x: Row) => !x.read).length || ""}
              </span>
            </button>
            <details className="profile-menu">
              <summary
                className="avatar"
                aria-label={t("Account menu", "অ্যাকাউন্ট মেনু")}
              >
                {user.name?.slice(0, 1)}
              </summary>
              <Link to="/app/settings">{t("Profile", "প্রোফাইল")}</Link>
              <button
                onClick={async () => {
                  await api("/logout", {});
                  qc.clear();
                  nav("/login");
                }}
              >
                {ui("Sign out")}
              </button>
            </details>
          </div>
        </header>
        <a className="skip-link" href="#main-content">
          {t("Skip to content", "মূল অংশে যান")}
        </a>
        <main id="main-content" tabIndex={-1} className="workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                {t("YOUR MESS, IN BALANCE", "আপনার মেস, সঠিক হিসাবে")}
              </span>
              <h1>
                {t(
                  navs.find((x) => x[0] === tab)?.[1] || "",
                  navs.find((x) => x[0] === tab)?.[2] || "",
                )}
              </h1>
            </div>
            <label className="month-picker">
              <CalendarDays size={17} />
              <input
                aria-label={ui("Statement month")}
                type="month"
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value || today().slice(0, 7))
                }
              />
            </label>
          </div>
          <div className="freshness">
            <span>
              {t("Last updated", "সর্বশেষ হালনাগাদ")}:{" "}
              {state.dataUpdatedAt
                ? new Date(state.dataUpdatedAt).toLocaleTimeString(
                    bn ? "bn-BD" : "en-GB",
                    { timeZone: "Asia/Dhaka" },
                  )
                : "—"}
            </span>
            <button disabled={!!form || state.isFetching} onClick={refresh}>
              {ui("Refresh latest data")}
            </button>
          </div>
          {error && !form && (
            <p className="error" role="alert">
              {error}
              <button onClick={refresh}>{ui("Refresh latest data")}</button>
            </p>
          )}
          {notice && (
            <p className="success" role="status">
              {notice}
            </p>
          )}
          {messes.error && <p className="error">{messes.error.message}</p>}
          {content()}
          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} Khalid Hasan.{" "}
              {t("All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।")}
            </span>
            <span>BDT · Asia/Dhaka</span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={!!form}
        onOpenChange={(v) => {
          if (!v && !busy) setForm(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            <Dialog.Title>{ui(form?.title || "")}</Dialog.Title>
            <Dialog.Description>
              {ui(
                form?.info ||
                  "Save accurate records. Changes are validated and recorded in the activity history.",
              )}
            </Dialog.Description>
            <Dialog.Close
              className="dialog-close icon-button"
              disabled={busy}
              aria-label={ui("Close dialog")}
            >
              <X />
            </Dialog.Close>
            {form && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const fd = new FormData(e.currentTarget),
                      p: Row = { ...form.preset };
                    for (const field of form.fields) {
                      if (field.type === "file") {
                        const file = fd.get(field.name) as File;
                        if (file?.size) {
                          const digest = Array.from(
                            new Uint8Array(
                              await crypto.subtle.digest(
                                "SHA-256",
                                await file.arrayBuffer(),
                              ),
                            ),
                          )
                            .map((x) => x.toString(16).padStart(2, "0"))
                            .join("");
                          if (form.uploads?.[field.name]?.digest === digest)
                            p[field.name] = form.uploads[field.name].key;
                          else {
                            setUploadProgress(0);
                            const key = await upload(
                              active!,
                              file,
                              setUploadProgress,
                            );
                            p[field.name] = key;
                            form.uploads = {
                              ...form.uploads,
                              [field.name]: { digest, key },
                            };
                            setUploadProgress(null);
                          }
                        }
                        continue;
                      }
                      const raw = String(fd.get(field.name) || "");
                      p[field.name] =
                        field.type === "checkbox"
                          ? fd.has(field.name)
                          : field.type === "json"
                            ? JSON.parse(raw || "{}")
                            : ["meal", "signed"].includes(field.type || "")
                              ? Number(raw)
                              : raw;
                    }
                    const payload = form.transform ? form.transform(p) : p;
                    let result;
                    if (form.endpoint) {
                      result = await api(
                        form.endpoint,
                        payload,
                        form.endpoint === "/me" ? "PATCH" : "POST",
                      );
                      if (form.endpoint === "/messes") {
                        setMess(result.id);
                        localStorage.setItem("activeMess", result.id);
                      }
                      if (form.endpoint === "/me")
                        await qc.invalidateQueries({ queryKey: ["me"] });
                    } else
                      result = await api(`/messes/${active}/actions`, {
                        action: form.action,
                        payload,
                        revision: state.data.revision,
                        requestId: form.requestId,
                      });
                    setForm(null);
                    setNotice(
                      result.url
                        ? `Invitation link (share only with the invited member): ${result.url}`
                        : ui("Saved successfully"),
                    );
                    await refresh();
                  } catch (e) {
                    setError((e as Error).message);
                    if (e instanceof ApiError && e.status === 409)
                      await refresh();
                  } finally {
                    setBusy(false);
                    setUploadProgress(null);
                  }
                }}
              >
                {form.fields.map((field) =>
                  field.type === "json" ? (
                    <StructuredField
                      key={field.name}
                      field={field}
                      members={members}
                    />
                  ) : (
                    <label
                      key={field.name}
                      className={
                        field.type === "checkbox" ? "checkbox-label" : ""
                      }
                    >
                      {field.type === "checkbox" ? (
                        <>
                          <input
                            type="checkbox"
                            name={field.name}
                            defaultChecked={field.value === true}
                          />
                          {ui(field.label)}
                        </>
                      ) : (
                        <>
                          {ui(field.label)}
                          {field.options ? (
                            <select
                              name={field.name}
                              aria-describedby={
                                error ? "dialog-error" : undefined
                              }
                              defaultValue={field.value}
                              required={!field.optional}
                            >
                              {field.options.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {ui(label)}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "textarea" ||
                            field.type === "json" ? (
                            <textarea
                              name={field.name}
                              defaultValue={field.value}
                              required={!field.optional}
                              rows={field.type === "json" ? 5 : 3}
                            />
                          ) : (
                            <input
                              name={field.name}
                              type={
                                ["meal", "signed"].includes(field.type || "")
                                  ? "number"
                                  : field.type || "text"
                              }
                              defaultValue={
                                field.type === "file" ? undefined : field.value
                              }
                              required={!field.optional}
                              {...(["number", "meal", "signed"].includes(
                                field.type || "",
                              )
                                ? {
                                    step: field.type === "meal" ? 0.5 : 0.01,
                                    min:
                                      field.type === "signed" ? undefined : 0,
                                  }
                                : {})}
                              accept={
                                field.type === "file"
                                  ? "image/jpeg,image/png,image/webp,application/pdf"
                                  : undefined
                              }
                            />
                          )}
                        </>
                      )}
                    </label>
                  ),
                )}
                {error && (
                  <p id="dialog-error" className="error" role="alert">
                    {error}
                  </p>
                )}
                {uploadProgress !== null && (
                  <label>
                    {t("Uploading receipt", "রসিদ আপলোড হচ্ছে")}:{" "}
                    {uploadProgress}%
                    <progress max="100" value={uploadProgress} />
                  </label>
                )}
                <button className="button dark" disabled={busy}>
                  {ui(busy ? "Saving…" : "Save changes")}
                </button>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
function ShieldIcon() {
  return <Check size={20} />;
}
