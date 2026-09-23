"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Utensils,
  Receipt,
  Wallet,
  Users,
  ArrowUpRight,
  Plus,
  ChevronRight,
  CalendarDays,
  Download,
  Check,
  LockKeyhole,
  History,
  Settings,
  LogOut,
  Leaf,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bdToday,
  demoLedger,
  emptyLedger,
  reconcile,
  type Ledger,
} from "@/lib/ledger";
const money = (v: number) =>
  "৳" +
  (v / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const links = [
  ["Overview", LayoutDashboard],
  ["Meal tracker", Utensils],
  ["Expenses", Receipt],
  ["Deposits", Wallet],
  ["Members", Users],
  ["Settlement", CalendarDays],
  ["Activity log", History],
  ["Settings", Settings],
] as const;
export default function MessMate() {
  const [data, setData] = useState<Ledger>(emptyLedger()),
    [view, setView] = useState("Overview"),
    [month, setMonth] = useState(bdToday().slice(0, 7)),
    [date, setDate] = useState(bdToday()),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [role, setRole] = useState("manager"),
    [myMember, setMyMember] = useState(""),
    [selected, setSelected] = useState(""),
    [version, setVersion] = useState(0),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all");
  const [householdId, setHouseholdId] = useState(""),
    [workspaces, setWorkspaces] = useState<
      { id: string; name: string; role: string }[]
    >([]);
  const summary = reconcile(data, month),
    locked = !!data.closed[month],
    manager = role === "manager";
  async function load() {
    try {
      const r = await fetch("/api/ledger" + window.location.search);
      if (r.status === 401) {
        setDemo(true);
        setData(demoLedger());
        return;
      }
      const j = (await r.json()) as {
        error: string;
        data: Ledger;
        version: number;
        role: string;
        memberId?: string;
        key: string;
        householdId: string;
        workspaces: { id: string; name: string; role: string }[];
      };
      if (!r.ok) throw Error(j.error);
      setHouseholdId(j.householdId);
      setWorkspaces(j.workspaces);
      setData(j.data);
      setVersion(j.version);
      setRole(j.role);
      setMyMember(j.memberId || "");
      setDemo(false);
    } catch (e) {
      setError(
        (e as Error).message || "Could not load your mess. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function mutate(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      if (demo)
        throw Error("This is sample data. Sign in to save your own mess.");
      const r = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload, version, householdId }),
      });
      const j = (await r.json()) as {
        error: string;
        data: Ledger;
        version: number;
        role: string;
        memberId?: string;
        key: string;
      };
      if (!r.ok) throw Error(j.error);
      setData(j.data);
      setVersion(j.version);
      setModal("");
      setNotice("Saved successfully");
      return j;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const mc = (document as any).modelContext;
    if (!mc?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      mc.registerTool(
        {
          name: "read_monthly_settlement",
          description:
            "Read the currently selected monthly meal and expense reconciliation.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: any) => {
            if (input && Object.keys(input).length)
              throw Error("No arguments accepted");
            return { month, ...summary, sample: demo };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, [data, month, demo]);
  function open(name: string, id = "") {
    setError("");
    setSelected(id);
    if (name === "Meals" && view !== "Meal tracker") setDate(bdToday());
    setModal(name);
  }
  function csv() {
    const rows = data.closed[month]?.rows || summary.rows;
    const fields = [
      "Name",
      "Meals",
      "Food BDT",
      "Shared BDT",
      "Deposits BDT",
      "Personal purchases BDT",
      "Due BDT",
    ];
    const esc = (v: unknown) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const text = [
      fields,
      ...rows.map((r) => [
        r.name,
        r.meals,
        ...[r.food, r.shared, r.deposit, r.personal, r.due].map((v) =>
          (v / 100).toFixed(2),
        ),
      ]),
    ]
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    const u = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = `messmate-${month}.csv`;
    a.click();
    URL.revokeObjectURL(u);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as Record<string, unknown>;
    if (modal === "Expense") {
      const file = fd.get("receipt") as File;
      if (file?.size) {
        if (demo) {
          setError("Sign in to upload receipts.");
          return;
        }
        const upload = new FormData();
        upload.set("file", file);
        setBusy(true);
        try {
          const r = await fetch(
            "/api/receipt?household=" + encodeURIComponent(householdId),
            { method: "POST", body: upload },
          );
          const j = (await r.json()) as {
            error: string;
            data: Ledger;
            version: number;
            role: string;
            memberId?: string;
            key: string;
          };
          if (!r.ok) throw Error(j.error);
          payload.receipt = j.key;
        } catch (e) {
          setError((e as Error).message);
          setBusy(false);
          return;
        }
      } else delete payload.receipt;
    }
    const actions: Record<string, string> = {
      Member: "member",
      "Edit member": "member_edit",
      "Void deposit": "void_deposit",
      Expense: "expense",
      Deposit: "deposit",
      Meals: "meal",
      Settings: "settings",
      "Close month": "close",
      Question: "question",
      Review: "review",
    };
    try {
      await mutate(actions[modal], { ...payload, month });
    } catch {}
  }
  const memberOptions = data.members.map((m) => (
    <option key={m.id} value={m.id}>
      {m.name}
    </option>
  ));
  const field = (
    label: string,
    name: string,
    type = "text",
    value?: string,
  ) => (
    <div className="field">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required
        defaultValue={value}
        onChange={
          name === "date" && modal === "Meals"
            ? (e) => setDate(e.target.value)
            : undefined
        }
        {...(type === "number"
          ? { min: 0.01, step: 0.01, max: 10000000 }
          : { maxLength: 150 })}
      />
    </div>
  );
  const select = (
    label: string,
    name: string,
    children: React.ReactNode,
    value?: string,
  ) => (
    <div className="field">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required
        defaultValue={value}
        onChange={
          name === "memberId" && modal === "Meals"
            ? (e) => setSelected(e.target.value)
            : undefined
        }
      >
        {children}
      </select>
    </div>
  );
  const expenses = data.expenses
    .filter(
      (e) =>
        e.date.startsWith(month) && (filter === "all" || e.status === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const editDeposit = data.deposits.find((d) => d.id === selected),
    editMember = data.members.find((m) => m.id === selected);
  const pending = data.expenses.filter(
    (e) =>
      e.date.startsWith(month) &&
      (e.status === "pending" || (e.question && !e.resolution)),
  ).length;
  const table = (headers: string[], rows: React.ReactNode) => (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((x) => (
            <TableHead key={x}>{x}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>{rows}</TableBody>
    </Table>
  );
  return (
    <SidebarProvider>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <a className="brand" href="/">
            <span className="brand-icon">
              <Utensils size={23} />
            </span>
            MessMate<span className="brand-dot">.</span>
          </a>
          <div className="house">
            <span className="house-icon">
              {data.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{data.name}</strong>
              <small>{data.members.length} members · Dhaka</small>
            </div>
          </div>
          {workspaces.length > 1 && (
            <div className="workspace-switch">
              <Label htmlFor="workspace-select">Switch mess</Label>
              <select
                id="workspace-select"
                value={householdId}
                onChange={(e) => {
                  window.location.href =
                    "/?household=" + encodeURIComponent(e.target.value);
                }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </SidebarHeader>
        <SidebarContent>
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {links.map(([label, Icon]) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  isActive={view === label}
                  onClick={() => setView(label)}
                  className="nav-item"
                >
                  <Icon />
                  <span>{label}</span>
                  {label === "Expenses" && pending > 0 && (
                    <span className="nav-count">{pending}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <Leaf size={22} />
            <strong>Good meals. Fair shares.</strong>
            <p>A little clarity makes living together easier.</p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="profile">
            <span className="avatar">{manager ? "M" : "U"}</span>
            <div>
              <strong>
                {demo
                  ? "Demo workspace"
                  : manager
                    ? "Mess manager"
                    : "Mess member"}
              </strong>
              <small>
                {demo ? "Explore with sample data" : "Your shared household"}
              </small>
            </div>
            {!demo && (
              <a aria-label="Sign out" href="/signout-with-chatgpt?return_to=/">
                <LogOut size={18} />
              </a>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="crumb">
            <SidebarTrigger />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="topright">
            <span className="timezone">Asia / Dhaka</span>
            <span className="avatar small">{manager ? "M" : "U"}</span>
          </div>
        </header>
        <main className="workspace">
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>Demo mode</strong> · Explore a sample mess. Sign in to
                create your own.
              </span>
              <a href="/signin-with-chatgpt?return_to=/" target="_top">
                Sign in <ArrowUpRight size={15} />
              </a>
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}{" "}
              <button
                onClick={() => {
                  setError("");
                  load();
                }}
              >
                Reload latest data
              </button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              <Check size={18} />
              {notice}
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR MESS, IN BALANCE</p>
              <h1>
                {view === "Overview"
                  ? "A clearer picture of your month."
                  : view}
              </h1>
              <p className="muted">
                {view === "Overview"
                  ? "Every meal counted. Every taka accounted for."
                  : view === "Settlement"
                    ? "See exactly how each member’s balance is calculated."
                    : view === "Meal tracker"
                      ? "Keep the daily count up to date for a fair monthly split."
                      : view === "Expenses"
                        ? "Keep purchases, receipts, and approvals in one place."
                        : view === "Deposits"
                          ? "Record money received into the shared mess fund."
                          : view === "Members"
                            ? "The people who make this place home."
                            : view === "Activity log"
                              ? "A lasting record of changes to your mess."
                              : "Set up your shared household."}
              </p>
            </div>
            <div className="heading-actions">
              <label className="month-picker">
                <CalendarDays size={17} />
                <input
                  aria-label="Selected month"
                  type="month"
                  value={month}
                  onChange={(e) =>
                    setMonth(e.target.value || bdToday().slice(0, 7))
                  }
                />
              </label>
              {view === "Overview" || view === "Expenses" ? (
                <Button
                  onClick={() => open("Expense")}
                  disabled={locked || !data.members.length}
                >
                  <Plus />
                  Add expense
                </Button>
              ) : view === "Members" && manager ? (
                <Button onClick={() => open("Member")}>
                  <Plus />
                  Add member
                </Button>
              ) : view === "Deposits" && manager ? (
                <Button
                  onClick={() => open("Deposit")}
                  disabled={locked || !data.members.length}
                >
                  <Plus />
                  Record deposit
                </Button>
              ) : null}
            </div>
          </div>
          {loading ? (
            <div className="empty">Loading your workspace…</div>
          ) : (
            <>
              {!data.members.length && view === "Overview" && (
                <div className="welcome">
                  <div>
                    <h2>Welcome to your mess.</h2>
                    <p>
                      Add yourself and your housemates to start tracking meals
                      and expenses.
                    </p>
                  </div>
                  <Button onClick={() => open("Member")}>
                    <Plus />
                    Add first member
                  </Button>
                </div>
              )}
              {view === "Overview" && (
                <>
                  <div className="stats">
                    <div className="stat dark">
                      <span>
                        Current meal rate <Utensils size={20} />
                      </span>
                      <strong>{money(summary.rate)}</strong>
                      <small>per meal this month</small>
                      <div className="stat-line" />
                      <p>{summary.totalMeals} meals shared so far</p>
                    </div>
                    <div className="stat">
                      <span>
                        Total expenses <Receipt size={20} />
                      </span>
                      <strong>{money(summary.food + summary.shared)}</strong>
                      <small>Approved expenses only</small>
                      <p>
                        <span className="mini-dot" /> {money(summary.food)} in
                        food costs
                      </p>
                    </div>
                    <div className="stat">
                      <span>
                        Fund deposits <ArrowDownLeft size={21} />
                      </span>
                      <strong>{money(summary.deposits)}</strong>
                      <small>Received from members</small>
                      <p>
                        {
                          data.deposits.filter(
                            (d) => !d.voided && d.date.startsWith(month),
                          ).length
                        }{" "}
                        recorded contributions
                      </p>
                    </div>
                    <div className="stat">
                      <span>
                        Cash in hand <Wallet size={20} />
                      </span>
                      <strong>{money(summary.cash)}</strong>
                      <small>Deposits − purchases from fund</small>
                      <p className={summary.cash < 0 ? "negative" : "positive"}>
                        {summary.cash < 0
                          ? "Fund needs a top-up"
                          : "Your shared fund balance"}
                      </p>
                    </div>
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-title">
                        <div>
                          <h2>Meal activity</h2>
                          <p className="muted">Daily meals across your mess</p>
                        </div>
                        <span className="pill">
                          {summary.totalMeals} total meals
                        </span>
                      </div>
                      <div
                        className="chart"
                        aria-label="Daily total meals this month"
                      >
                        {Array.from(
                          {
                            length: new Date(
                              Number(month.slice(0, 4)),
                              Number(month.slice(5)),
                              0,
                            ).getDate(),
                          },
                          (_, i) => {
                            const day = `${month}-${String(i + 1).padStart(2, "0")}`,
                              n = data.meals
                                .filter((m) => m.date === day)
                                .reduce(
                                  (s, m) =>
                                    s + m.breakfast + m.lunch + m.dinner,
                                  0,
                                );
                            return (
                              <div
                                className="bar-column"
                                key={day}
                                title={`${day}: ${n} meals`}
                              >
                                <div
                                  className="bar"
                                  style={{
                                    height: `${Math.max(3, Math.min(100, (n / Math.max(data.members.length * 3, 1)) * 100))}%`,
                                    opacity: n ? 1 : 0.15,
                                  }}
                                />
                                {i % 5 === 0 && <small>{i + 1}</small>}
                              </div>
                            );
                          },
                        )}
                      </div>
                      <div className="chart-footer">
                        <span>
                          <i /> Meals logged
                        </span>
                        <button onClick={() => setView("Meal tracker")}>
                          Open meal tracker <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </section>
                    <section className="panel quick">
                      <span className="icon-tile">
                        <Utensils />
                      </span>
                      <h2>What’s on your plate?</h2>
                      <p className="muted">
                        Add today’s meals so everyone’s share stays fair.
                      </p>
                      <div className="today-count">
                        <span>Meals logged today</span>
                        <strong>
                          {data.meals
                            .filter((m) => m.date === bdToday())
                            .reduce(
                              (s, m) => s + m.breakfast + m.lunch + m.dinner,
                              0,
                            )}
                        </strong>
                      </div>
                      <Button
                        onClick={() =>
                          open("Meals", myMember || data.members[0]?.id)
                        }
                        disabled={!data.members.length}
                      >
                        <Plus size={17} /> Log meals
                      </Button>
                      <button
                        className="text-action"
                        onClick={() => setView("Settlement")}
                      >
                        Review monthly settlement <ChevronRight size={15} />
                      </button>
                    </section>
                  </div>
                  <div className="overview-grid bottom-grid">
                    <section className="panel">
                      <div className="panel-title">
                        <h2>Recent expenses</h2>
                        <button
                          className="text-action"
                          onClick={() => setView("Expenses")}
                        >
                          View all <ArrowUpRight size={15} />
                        </button>
                      </div>
                      {expenses.slice(0, 4).map((e) => (
                        <div className="expense-line" key={e.id}>
                          <span className={`expense-icon ${e.category}`}>
                            <Receipt size={18} />
                          </span>
                          <div>
                            <strong>{e.title}</strong>
                            <small>
                              {
                                data.members.find((m) => m.id === e.paidBy)
                                  ?.name
                              }{" "}
                              · {e.date}
                            </small>
                          </div>
                          <div className="align-right">
                            <strong>{money(e.amount)}</strong>
                            <span className={`status ${e.status}`}>
                              {e.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {!expenses.length && (
                        <div className="empty">
                          No expenses yet. Add your first purchase.
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-title">
                        <h2>This month’s split</h2>
                        <span className="pill">
                          {locked ? "Finalized" : "Live estimate"}
                        </span>
                      </div>
                      <div className="split-row">
                        <span>Food</span>
                        <strong>{money(summary.food)}</strong>
                      </div>
                      <div className="split-track">
                        <i
                          style={{
                            width: `${summary.food + summary.shared ? (summary.food / (summary.food + summary.shared)) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div className="split-row">
                        <span>
                          <i className="legend food" /> By meal count
                        </span>
                        <span>
                          <i className="legend shared" /> Shared equally
                        </span>
                      </div>
                      <div className="split-row shared-total">
                        <span>Rent & utilities</span>
                        <strong>{money(summary.shared)}</strong>
                      </div>
                      <p className="note">
                        Food costs follow your meals. Rent and utilities are
                        divided equally between members who joined by this
                        month.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {view === "Meal tracker" && (
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Daily meal register</h2>
                      <p className="muted">
                        Breakfast, lunch, and dinner each count as one meal.
                      </p>
                    </div>
                    <Input
                      aria-label="Meal date"
                      className="date-input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  {table(
                    [
                      "Member",
                      "Breakfast",
                      "Lunch",
                      "Dinner",
                      "Total",
                      "Actions",
                    ],
                    data.members.map((m) => {
                      const meal = data.meals.find(
                        (x) => x.memberId === m.id && x.date === date,
                      );
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <span className="member-name">
                              <span className="avatar">
                                {m.name.slice(0, 2)}
                              </span>
                              {m.name}
                            </span>
                          </TableCell>
                          {["breakfast", "lunch", "dinner"].map((k) => (
                            <TableCell key={k}>
                              {meal?.[k as "breakfast"] ?? "—"}
                            </TableCell>
                          ))}
                          <TableCell>
                            {meal
                              ? meal.breakfast + meal.lunch + meal.dinner
                              : 0}
                          </TableCell>
                          <TableCell>
                            {(manager || m.id === myMember) && (
                              <Button
                                variant="outline"
                                onClick={() => open("Meals", m.id)}
                                disabled={!!data.closed[date.slice(0, 7)]}
                              >
                                Edit meals
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }),
                  )}
                  <p className="note">
                    Members can change meals until 10:00 AM on that day
                    (Bangladesh time). Managers can correct past entries while
                    the month is open. All changes are recorded.
                  </p>
                  {!data.members.length && (
                    <div className="empty">
                      Add members before logging meals.
                    </div>
                  )}
                </section>
              )}
              {view === "Expenses" && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>Expense register</h2>
                    <select
                      aria-label="Filter expenses"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      <option value="pending">Pending review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  {table(
                    [
                      "Purchase",
                      "Paid by",
                      "Category",
                      "Amount",
                      "Status",
                      "Actions",
                    ],
                    expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <strong>{e.title}</strong>
                          <small>
                            {e.date} ·{" "}
                            {e.source === "personal"
                              ? "Personal money"
                              : "Mess fund"}
                          </small>
                          {e.receipt && (
                            <a
                              href={`/api/receipt?key=${encodeURIComponent(e.receipt)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View receipt
                            </a>
                          )}
                          {e.question && (
                            <p className="question">
                              Question: {e.question}
                              {e.resolution && (
                                <>
                                  <br />
                                  Resolution: {e.resolution}
                                </>
                              )}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {data.members.find((m) => m.id === e.paidBy)?.name}
                        </TableCell>
                        <TableCell className="capitalize">
                          {e.category}
                        </TableCell>
                        <TableCell>{money(e.amount)}</TableCell>
                        <TableCell>
                          <span className={`status ${e.status}`}>
                            {e.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="row-actions">
                            {!locked && manager && (
                              <Button
                                variant="outline"
                                onClick={() => open("Review", e.id)}
                              >
                                Review
                              </Button>
                            )}
                            {!locked && (
                              <Button
                                variant="ghost"
                                onClick={() => open("Question", e.id)}
                              >
                                Question
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                  {!expenses.length && (
                    <div className="empty">
                      No expenses match this month and filter.
                    </div>
                  )}
                </section>
              )}
              {view === "Deposits" && (
                <section className="panel">
                  <div className="panel-title">
                    <h2>Contributions to the fund</h2>
                    <span className="pill">
                      Total {money(summary.deposits)}
                    </span>
                  </div>
                  {table(
                    ["Member", "Date", "Note", "Amount", "Actions"],
                    data.deposits
                      .filter((d) => d.date.startsWith(month))
                      .map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            {
                              data.members.find((m) => m.id === d.memberId)
                                ?.name
                            }
                          </TableCell>
                          <TableCell>{d.date}</TableCell>
                          <TableCell>
                            {d.note || "—"}
                            {d.correctionReason && (
                              <small>{d.correctionReason}</small>
                            )}
                          </TableCell>
                          <TableCell className={d.voided ? "voided" : ""}>
                            {money(d.amount)}
                            {d.voided && (
                              <small>Voided · excluded from totals</small>
                            )}
                          </TableCell>
                          <TableCell>
                            {manager && !locked && !d.voided && (
                              <div className="row-actions">
                                <Button
                                  variant="outline"
                                  onClick={() => open("Deposit", d.id)}
                                >
                                  Correct
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => open("Void deposit", d.id)}
                                >
                                  Void
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )),
                  )}
                  <p className="note">
                    A deposit records money already received. MessMate does not
                    transfer money or process payments.
                  </p>
                </section>
              )}
              {view === "Members" && (
                <div className="member-grid">
                  {data.members.map((m, i) => (
                    <section className="panel member-card" key={m.id}>
                      <span className={`avatar color-${i % 3}`}>
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <h2>{m.name}</h2>
                      <p className="muted">{m.email}</p>
                      <span className="pill">Joined {m.joined}</span>
                      {manager && (
                        <Button
                          variant="ghost"
                          onClick={() => open("Edit member", m.id)}
                        >
                          Edit details
                        </Button>
                      )}
                      <div className="split-row">
                        <span>This month’s meals</span>
                        <strong>
                          {summary.rows.find((r) => r.id === m.id)?.meals || 0}
                        </strong>
                      </div>
                    </section>
                  ))}
                  {!data.members.length && (
                    <section className="panel empty">
                      <Users size={34} />
                      <h2>Start with your mess members</h2>
                      <p>Add yourself and the people you share meals with.</p>
                      <Button onClick={() => open("Member")}>
                        <Plus />
                        Add first member
                      </Button>
                    </section>
                  )}
                </div>
              )}
              {view === "Settlement" && (
                <>
                  <div className="settlement-intro">
                    <div>
                      <span className="pill">
                        {locked ? "Finalized month" : "Open month"}
                      </span>
                      <h2>A fair share, down to the paisa.</h2>
                      <p>
                        Food share + equal shared costs − deposits − personal
                        purchases = balance due.
                      </p>
                    </div>
                    <div className="row-actions">
                      <Button variant="outline" onClick={csv}>
                        <Download />
                        Export CSV
                      </Button>
                      {manager && !locked && (
                        <Button onClick={() => open("Close month")}>
                          <LockKeyhole />
                          Finalize month
                        </Button>
                      )}
                    </div>
                  </div>
                  <section className="panel">
                    {table(
                      [
                        "Member",
                        "Meals",
                        "Food share",
                        "Shared costs",
                        "Deposits",
                        "Personal purchases",
                        "Balance",
                      ],
                      (data.closed[month]?.rows || summary.rows).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <strong>{r.name}</strong>
                          </TableCell>
                          <TableCell>{r.meals}</TableCell>
                          {[r.food, r.shared, r.deposit, r.personal].map(
                            (n, i) => (
                              <TableCell key={i}>{money(n)}</TableCell>
                            ),
                          )}
                          <TableCell>
                            <strong
                              className={r.due > 0 ? "negative" : "positive"}
                            >
                              {money(Math.abs(r.due))}
                            </strong>
                            <small>
                              {r.due > 0
                                ? "To pay"
                                : r.due < 0
                                  ? "Credit / refund"
                                  : "Settled"}
                            </small>
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                    <p className="note">
                      Meal rate = {money(summary.food)} ÷ {summary.totalMeals}{" "}
                      meals = {money(summary.rate)}. Shares use the unrounded
                      rate; remaining paisa are distributed consistently so
                      totals match exactly. Shared costs are not prorated.
                    </p>
                    {summary.food > 0 && !summary.totalMeals && (
                      <p className="error">
                        Log meals before allocating food expenses or finalizing
                        this month.
                      </p>
                    )}
                  </section>
                  <div className="panel settlement-note">
                    <h2>Before you finalize</h2>
                    <p>
                      {pending
                        ? `${pending} expense(s) still need approval or a question resolved.`
                        : "No pending expenses or unresolved questions this month."}
                    </p>
                    <p className="muted">
                      Finalizing saves a permanent snapshot and prevents changes
                      to this month. Credits are shown for refund or manual
                      settlement; they do not automatically carry forward.
                    </p>
                  </div>
                </>
              )}
              {view === "Activity log" && (
                <section className="panel">
                  <h2>Change history</h2>
                  {[...data.history].reverse().map((h, i) => (
                    <div className="expense-line" key={i}>
                      <span className="expense-icon">
                        <History size={18} />
                      </span>
                      <div>
                        <strong>{h.action}</strong>
                        <small>
                          {h.actor} ·{" "}
                          {new Date(h.at).toLocaleString("en-GB", {
                            timeZone: "Asia/Dhaka",
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                  {!data.history.length && (
                    <div className="empty">
                      Changes to your mess will appear here.
                    </div>
                  )}
                </section>
              )}
              {view === "Settings" && (
                <section className="panel settings-panel">
                  <h2>{data.name}</h2>
                  <p className="muted">
                    Currency: Bangladeshi taka (BDT) · Time zone: Asia/Dhaka
                  </p>
                  <p>
                    Breakfast, lunch, and dinner each count as one meal. Rent
                    and utilities are shared equally among members who joined by
                    the selected month.
                  </p>
                  <p>
                    Members can update meals before 10:00 AM Bangladesh time.
                    Expense submissions need manager approval.
                  </p>
                  <p>
                    Member email addresses connect invited people to their
                    records. If you belong to more than one mess, use Switch
                    mess in the sidebar. Site sharing must separately allow a
                    member to open this private deployment.
                  </p>
                  {manager && (
                    <Button onClick={() => open("Settings")}>
                      Edit mess name
                    </Button>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              MessMate <span>·</span> Made for living together.
            </span>
            <span>All amounts in BDT</span>
          </footer>
        </main>
      </SidebarInset>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v && !busy) setModal("");
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal === "Meals"
                ? "Log meals"
                : modal === "Member"
                  ? "Add a member"
                  : modal === "Expense"
                    ? "Add an expense"
                    : modal === "Deposit"
                      ? "Record a deposit"
                      : modal === "Close month"
                        ? "Finalize this month?"
                        : modal}
            </DialogTitle>
            <DialogDescription>
              {modal === "Close month"
                ? `${month} will be locked permanently. Review all records first.`
                : "Keep your shared records accurate and up to date."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="entry-form">
            {modal === "Member" && (
              <>
                {field("Full name", "name")}
                {field("Email for member access", "email", "email")}
                {field("Joining date", "joined", "date", bdToday())}
              </>
            )}
            {modal === "Expense" && (
              <>
                {field("What was purchased?", "title")}
                {field("Amount (BDT)", "amount", "number")}
                {field("Purchase date", "date", "date", bdToday())}
                {select(
                  "Category",
                  "category",
                  <>
                    <option value="food">Food · split by meals</option>
                    <option value="rent">Rent · split equally</option>
                    <option value="utilities">Utilities · split equally</option>
                  </>,
                )}
                {select(
                  "Purchased by",
                  "paidBy",
                  manager
                    ? memberOptions
                    : data.members
                        .filter((m) => m.id === myMember)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        )),
                )}
                {select(
                  "Payment source",
                  "source",
                  <>
                    <option value="fund">Mess fund</option>
                    <option value="personal">
                      Personal money · credited to member
                    </option>
                  </>,
                )}
                <div className="field">
                  <Label htmlFor="receipt">
                    Receipt (optional · image or PDF, up to 5 MB)
                  </Label>
                  <Input
                    id="receipt"
                    name="receipt"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                  />
                </div>
              </>
            )}
            {modal === "Deposit" && (
              <>
                {selected && <input type="hidden" name="id" value={selected} />}
                {select(
                  "Member",
                  "memberId",
                  memberOptions,
                  editDeposit?.memberId,
                )}
                {field(
                  "Amount received (BDT)",
                  "amount",
                  "number",
                  editDeposit
                    ? (editDeposit.amount / 100).toFixed(2)
                    : undefined,
                )}
                {field(
                  "Date received",
                  "date",
                  "date",
                  editDeposit?.date || bdToday(),
                )}
                {field("Note / reference", "note", "text", editDeposit?.note)}
                {selected && field("Why is this being corrected?", "reason")}
              </>
            )}
            {modal === "Meals" && (
              <>
                {manager ? (
                  select("Member", "memberId", memberOptions, selected)
                ) : (
                  <input type="hidden" name="memberId" value={myMember} />
                )}
                {field("Meal date", "date", "date", date)}
                {["breakfast", "lunch", "dinner"].map((k) => (
                  <div className="field" key={k + selected + date}>
                    <Label className="capitalize" htmlFor={k}>
                      {k}
                    </Label>
                    <Input
                      id={k}
                      name={k}
                      type="number"
                      min="0"
                      max="20"
                      step="1"
                      defaultValue={
                        data.meals.find(
                          (m) => m.memberId === selected && m.date === date,
                        )?.[k as "breakfast"] ?? 1
                      }
                      required
                    />
                  </div>
                ))}
                <p className="note">
                  Enter 0 for no meal. Guest meals can be included in your
                  count.
                </p>
              </>
            )}
            {modal === "Edit member" && (
              <>
                <input type="hidden" name="id" value={selected} />
                {field("Full name", "name", "text", editMember?.name)}
                {field(
                  "Email for member access",
                  "email",
                  "email",
                  editMember?.email,
                )}
              </>
            )}
            {modal === "Void deposit" && (
              <>
                <input type="hidden" name="id" value={selected} />
                <p>
                  Exclude this {money(editDeposit?.amount || 0)} deposit from
                  the balance? Its original record remains in the history.
                </p>
                {field("Reason for voiding", "reason")}
                <label className="confirm">
                  <input type="checkbox" required /> I confirm this deposit
                  should not count.
                </label>
              </>
            )}
            {modal === "Settings" &&
              field("Mess name", "name", "text", data.name)}
            {modal === "Question" && (
              <>
                <input type="hidden" name="id" value={selected} />
                {field("What needs clarification?", "question")}
              </>
            )}
            {modal === "Review" && (
              <>
                <input type="hidden" name="id" value={selected} />
                {select(
                  "Decision",
                  "status",
                  <>
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                  </>,
                )}
                {field("Review note / resolution", "resolution")}
              </>
            )}
            {modal === "Close month" && (
              <>
                <p>
                  Approved food costs: <strong>{money(summary.food)}</strong>
                  <br />
                  Shared costs: <strong>{money(summary.shared)}</strong>
                  <br />
                  Members: <strong>{summary.rows.length}</strong>
                </p>
                <label className="confirm">
                  <input type="checkbox" required /> I have reviewed the meals,
                  expenses and deposits.
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {demo && (
              <p className="note">
                Sample workspace.{" "}
                <a href="/signin-with-chatgpt?return_to=/" target="_top">
                  Sign in to save real records.
                </a>
              </p>
            )}
            <Button type="submit" disabled={busy || demo}>
              {busy
                ? "Saving…"
                : modal === "Close month"
                  ? "Finalize and lock month"
                  : "Save changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
