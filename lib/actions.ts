import { reconcile, type Ledger } from "./ledger";
// Pure domain validation is shared by the API and automated tests.
export class RuleError extends Error {}
const fail = (message: string): never => {
  throw new RuleError(message);
};
function text(v: unknown, label: string, max = 150) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(`${label} is required (up to ${max} characters).`);
  return (v as string).trim();
}
function date(v: unknown) {
  const s = text(v, "Date", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    isNaN(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s ||
    s < "2020-01-01" ||
    s > "2100-12-31"
  )
    fail("Enter a valid date between 2020 and 2100.");
  return s;
}
function amount(v: unknown) {
  const s = String(v);
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    fail("Amount must be positive with no more than two decimal places.");
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1000000000)
    fail("Amount must be between ৳0.01 and ৳10,000,000.");
  return n;
}
export function applyAction(
  data: Ledger,
  action: string,
  p: Record<string, unknown>,
  auth: {
    manager: boolean;
    memberId?: string;
    email: string;
    household: string;
  },
  now = new Date(),
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const manager = () => {
    if (!auth.manager) fail("Only the mess manager can perform this action.");
  };
  const open = (d: string) => {
    if (data.closed[d.slice(0, 7)])
      fail("This month is finalized and cannot be changed.");
  };
  const member = (id: unknown, d?: string) => {
    const m = data.members.find((m) => m.id === id);
    if (!m) fail("Choose an existing member.");
    if (d && m!.joined > d) fail("The date is before this member joined.");
    return m!;
  };
  let description = "";
  if (action === "member") {
    manager();
    if (data.members.length >= 100)
      fail("This mess supports up to 100 members.");
    const joined = date(p.joined);
    if (Object.keys(data.closed).some((m) => m >= joined.slice(0, 7)))
      fail("Joining date would affect a finalized month. Choose a later date.");
    const email = text(p.email, "Email", 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Enter a valid email address.");
    if (data.members.some((m) => m.email === email))
      fail("This email already belongs to a member.");
    const name = text(p.name, "Name", 80);
    data.members.push({ id: crypto.randomUUID(), name, email, joined });
    description = `Added ${name}, joining ${joined}`;
  } else if (action === "meal") {
    const d = date(p.date);
    open(d);
    const m = member(p.memberId, d);
    if (!auth.manager) {
      if (m.id !== auth.memberId) fail("You can only update your own meals.");
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(now),
      );
      if (d < today || (d === today && hour >= 10))
        fail(
          "Meal changes close at 10:00 AM Bangladesh time. Ask your manager for a correction.",
        );
    }
    const counts = ["breakfast", "lunch", "dinner"].map((k) => {
      if (!/^\d+$/.test(String(p[k])))
        fail("Meal counts must be whole numbers from 0 to 20.");
      const n = Number(p[k]);
      if (n < 0 || n > 20) fail("Meal counts must be from 0 to 20.");
      return n;
    });
    const old = data.meals.find((x) => x.memberId === m.id && x.date === d);
    data.meals = data.meals.filter(
      (x) => !(x.memberId === m.id && x.date === d),
    );
    data.meals.push({
      id: `${m.id}-${d}`,
      memberId: m.id,
      date: d,
      breakfast: counts[0],
      lunch: counts[1],
      dinner: counts[2],
    });
    description = `${m.name} meals ${d}: ${old ? `${old.breakfast}/${old.lunch}/${old.dinner}` : "not logged"} → ${counts.join("/")}`;
  } else if (action === "expense") {
    const d = date(p.date);
    open(d);
    if (d > today) fail("Expenses cannot be recorded in the future.");
    const m = member(p.paidBy, d);
    if (!auth.manager && m.id !== auth.memberId)
      fail("Submit your own purchases only.");
    if (!["food", "rent", "utilities"].includes(String(p.category)))
      fail("Choose a valid expense category.");
    if (!["fund", "personal"].includes(String(p.source)))
      fail("Choose a valid payment source.");
    const title = text(p.title, "Purchase description");
    const a = amount(p.amount);
    const receipt = typeof p.receipt === "string" ? p.receipt : undefined;
    if (receipt && !receipt.startsWith(auth.household + "/"))
      fail("Invalid receipt.");
    data.expenses.push({
      id: crypto.randomUUID(),
      title,
      date: d,
      amount: a,
      category: p.category as any,
      source: p.source as any,
      paidBy: m.id,
      status: "pending",
      ...(receipt ? { receipt } : {}),
    });
    description = `Submitted ${title}: ৳${(a / 100).toFixed(2)} from ${p.source}, pending review`;
  } else if (action === "deposit") {
    manager();
    const d = date(p.date);
    open(d);
    if (d > today) fail("Deposits cannot be recorded in the future.");
    const m = member(p.memberId, d),
      a = amount(p.amount),
      note = text(p.note, "Reference");
    const old = p.id ? data.deposits.find((x) => x.id === p.id) : undefined;
    if (p.id && !old) fail("Deposit not found.");
    if (old) {
      open(old.date);
      if (old.voided)
        fail(
          "A voided deposit cannot be edited. Record a new deposit instead.",
        );
      const reason = text(p.reason, "Correction reason");
      description = `Corrected deposit ${old.id}: ${JSON.stringify({ memberId: old.memberId, date: old.date, amount: old.amount, note: old.note })} → ${JSON.stringify({ memberId: m.id, date: d, amount: a, note })}. Reason: ${reason}`;
      Object.assign(old, {
        memberId: m.id,
        date: d,
        amount: a,
        note,
        correctionReason: reason,
      });
    } else {
      data.deposits.push({
        id: crypto.randomUUID(),
        memberId: m.id,
        date: d,
        amount: a,
        note,
      });
      description = `Recorded ৳${(a / 100).toFixed(2)} deposit from ${m.name}`;
    }
  } else if (action === "void_deposit") {
    manager();
    const deposit = data.deposits.find((x) => x.id === p.id);
    if (!deposit) fail("Deposit not found.");
    open(deposit!.date);
    if (deposit!.voided) fail("This deposit is already voided.");
    const reason = text(p.reason, "Reason");
    deposit!.voided = true;
    deposit!.correctionReason = reason;
    description = `Voided deposit ${deposit!.id}, ৳${(deposit!.amount / 100).toFixed(2)}: ${reason}`;
  } else if (action === "member_edit") {
    manager();
    const m = member(p.id);
    const name = text(p.name, "Name", 80),
      email = text(p.email, "Email", 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Enter a valid email address.");
    if (data.members.some((x) => x.id !== m.id && x.email === email))
      fail("This email already belongs to a member.");
    description = `Updated member ${m.id}: ${m.name} (${m.email}) → ${name} (${email})`;
    Object.assign(m, { name, email });
  } else if (action === "review") {
    manager();
    const e = data.expenses.find((e) => e.id === p.id);
    if (!e) fail("Expense not found.");
    open(e!.date);
    if (!["approved", "rejected"].includes(String(p.status)))
      fail("Choose approve or reject.");
    const resolution = text(p.resolution, "Review note");
    description = `Reviewed ${e!.title}: ${e!.status} → ${p.status}. ${resolution}`;
    e!.status = p.status as any;
    e!.resolution = resolution;
  } else if (action === "question") {
    const e = data.expenses.find((e) => e.id === p.id);
    if (!e) fail("Expense not found.");
    open(e!.date);
    if (e!.question && !e!.resolution)
      fail("This expense already has an unresolved question.");
    e!.question = text(p.question, "Question");
    e!.resolution = undefined;
    description = `Questioned ${e!.title}: ${e!.question}`;
  } else if (action === "settings") {
    manager();
    const name = text(p.name, "Mess name", 80);
    description = `Renamed mess: ${data.name} → ${name}`;
    data.name = name;
  } else if (action === "close") {
    manager();
    const month = text(p.month, "Month", 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail("Choose a valid month.");
    open(month);
    if (month >= today.slice(0, 7))
      fail("Finalize a month after it has ended.");
    if (
      data.expenses.some(
        (e) =>
          e.date.startsWith(month) &&
          (e.status === "pending" || (e.question && !e.resolution)),
      )
    )
      fail("Review all pending expenses and resolve all questions first.");
    const summary = reconcile(data, month);
    if (!summary.rows.length)
      fail("There are no eligible members for this month.");
    if (summary.food && !summary.totalMeals)
      fail("Log meals before splitting food costs.");
    data.closed[month] = { at: now.toISOString(), rows: summary.rows };
    description = `Finalized ${month}; ${summary.rows.length} member balances locked`;
  } else fail("Unknown action.");
  data.history.push({
    at: now.toISOString(),
    actor: auth.email,
    action: description,
  });
  return data;
}
