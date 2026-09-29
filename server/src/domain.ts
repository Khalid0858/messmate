import { randomUUID } from "node:crypto";
import { z } from "zod";
export const slots = ["breakfast", "lunch", "dinner"] as const;
export type Slot = (typeof slots)[number];
export type Member = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  joined: string;
  left?: string;
};
export type Actor = {
  userId: string;
  name: string;
  email: string;
  admin: boolean;
  manager: boolean;
  memberId?: string;
};
export type RecordRow = Record<string, any>;
export type Ledger = {
  schemaVersion: 2;
  name: string;
  location: string;
  members: Member[];
  managers: Record<string, string>;
  rules: RecordRow[];
  meals: RecordRow[];
  menus: RecordRow[];
  deposits: RecordRow[];
  expenses: RecordRow[];
  advances: RecordRow[];
  transfers: RecordRow[];
  duties: RecordRow[];
  stock: RecordRow[];
  stockThresholds?: RecordRow[];
  corrections: RecordRow[];
  notices: RecordRow[];
  accounts: RecordRow[];
  closed: Record<string, any>;
  audit: RecordRow[];
  notifications: RecordRow[];
  outbox: RecordRow[];
  requests: string[];
  recurrences: RecordRow[];
  versions?: Record<string, RecordRow[]>;
  reopened?: Record<string, RecordRow>;
  legacy?: RecordRow;
  invites: RecordRow[];
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const reject = (m: string): never => {
  throw new DomainError(m);
};
export const text = (v: unknown, max = 160) =>
  z.string().trim().min(1).max(max).parse(v);
export const day = (v: unknown) => {
  const s = z
    .string()
    .regex(/^20\d\d-\d\d-\d\d$/)
    .parse(v);
  if (
    !Number.isFinite(Date.parse(s)) ||
    new Date(s).toISOString().slice(0, 10) !== s
  )
    reject("Invalid date");
  return s;
};
export const month = (v: unknown) =>
  z
    .string()
    .regex(/^20\d\d-(0[1-9]|1[0-2])$/)
    .parse(v);
export const taka = (v: unknown) => {
  const s = String(v);
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    reject("Use a positive BDT amount with at most two decimals");
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000000)
    reject("Amount out of range");
  return n;
};
export const bdDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
const bdTime = (now: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
export function createLedger(name: string, owner: Member): Ledger {
  return {
    schemaVersion: 2,
    name,
    location: "",
    members: [owner],
    managers: {},
    rules: [
      {
        effective: "2020-01",
        weights: { breakfast: 1, lunch: 1, dinner: 1 },
        half: true,
        guests: true,
        categories: {
          food: "meal",
          rent: "equal",
          electricity: "equal",
          gas: "equal",
          water: "equal",
          internet: "equal",
          cook: "equal",
          cleaning: "equal",
          other: "equal",
        },
      },
    ],
    meals: [],
    menus: [],
    deposits: [],
    expenses: [],
    advances: [],
    transfers: [],
    duties: [],
    stock: [],
    corrections: [],
    notices: [],
    accounts: [],
    closed: {},
    audit: [],
    notifications: [],
    outbox: [],
    requests: [],
    recurrences: [],
    invites: [],
  };
}
export const ruleFor = (d: Ledger, m: string) =>
  d.rules
    .filter((r) => r.effective <= m)
    .sort((a, b) => b.effective.localeCompare(a.effective))[0];
export const eligible = (m: Member, date: string) =>
  m.joined <= date && (!m.left || m.left >= date);
export function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) {
    if (total) reject("No eligible members or meal units for this cost");
    return weights.map(() => 0);
  }
  const bigSum = BigInt(sum),
    raw = weights.map((w) => BigInt(total) * BigInt(w)),
    out = raw.map((n) => Number(n / bigSum));
  const order = raw
    .map((n, i) => ({ i, r: n % bigSum }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let n = total - out.reduce((a, b) => a + b, 0), i = 0; i < n; i++)
    out[order[i].i]++;
  return out;
}
export function settlement(d: Ledger, m: string) {
  month(m);
  if (Object.keys(d.reopened || {}).some((k) => k < m))
    reject(
      "Finalize the reopened earlier month before calculating later balances",
    );
  const end = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 0))
    .toISOString()
    .slice(0, 10);
  const previous = Object.keys(d.closed)
    .filter((k) => k < m)
    .sort()
    .at(-1);
  const prior = d.closed[previous || ""];
  const opening =
    prior && !prior.legacy
      ? prior.rows
      : (d.legacy && d.legacy.cutover <= m ? d.legacy.opening : []) || [];
  const members = d.members.filter(
    (x) =>
      x.joined <= end &&
      (!x.left ||
        x.left >= m + "-01" ||
        opening.some((r: any) => r.id === x.id && r.due !== 0) ||
        d.deposits.some((v) => v.memberId === x.id && v.date.startsWith(m)) ||
        d.transfers.some((v) => v.memberId === x.id && v.date.startsWith(m))),
  );
  const rule = ruleFor(d, m);
  const units = members.map((x) =>
    d.meals
      .filter((v) => v.memberId === x.id && v.date.startsWith(m))
      .reduce(
        (s, v) =>
          s +
          slots.reduce(
            (a, k) => a + (v[k] || 0) * (v.weights?.[k] || rule.weights[k]),
            0,
          ),
        0,
      ),
  );
  const costs = members.map(() => 0);
  let food = 0,
    unallocated = 0;
  for (const e of d.expenses.filter(
    (e) => e.date.startsWith(m) && e.status === "approved",
  )) {
    if (e.category === "food") food += e.amount;
    let share: number[];
    const valid = members.map((x) => (eligible(x, e.date) ? 1 : 0));
    if (e.split === "fixed") {
      share = members.map((x) => e.fixed?.[x.id] || 0);
      if (share.reduce((a, b) => a + b, 0) !== e.amount)
        reject("Fixed shares do not match expense");
    } else {
      const weights =
        e.split === "meal"
          ? units
          : e.split === "occupancy"
            ? members.map((x) => {
                const start = x.joined > m + "-01" ? x.joined : m + "-01";
                const finish = x.left && x.left < end ? x.left : end;
                return Math.max(
                  0,
                  (Date.parse(finish) - Date.parse(start)) / 86400000 + 1,
                );
              })
            : valid;
      if (!weights.some(Boolean)) {
        unallocated += e.amount;
        share = members.map(() => 0);
      } else share = allocate(e.amount, weights);
    }
    share.forEach((v, i) => (costs[i] += v));
  }
  const rows = members.map((x, i) => {
    const deposits = d.deposits
      .filter(
        (v) =>
          v.memberId === x.id &&
          v.date.startsWith(m) &&
          v.status === "approved",
      )
      .reduce((s, v) => s + v.amount, 0);
    const personal = d.expenses
      .filter(
        (v) =>
          v.paidBy === x.id &&
          v.date.startsWith(m) &&
          v.status === "approved" &&
          v.source === "personal",
      )
      .reduce((s, v) => s + v.amount, 0);
    const payouts = d.transfers
      .filter((v) => v.memberId === x.id && v.date.startsWith(m))
      .reduce((s, v) => s + v.amount, 0);
    const initial = opening.find((r: any) => r.id === x.id)?.due || 0;
    return {
      ...x,
      units: units[i],
      meals: units[i] / 2,
      cost: costs[i],
      opening: initial,
      deposits,
      personal,
      payouts,
      due: initial + costs[i] - deposits - personal + payouts,
    };
  });
  const through = (x: RecordRow) => x.date <= end;
  const cash =
    d.deposits
      .filter((x) => through(x) && x.status === "approved")
      .reduce((s, x) => s + x.amount, 0) -
    d.expenses
      .filter(
        (x) => through(x) && x.status === "approved" && x.source === "fund",
      )
      .reduce((s, x) => s + x.amount, 0) -
    d.advances
      .filter(through)
      .reduce(
        (s, x) =>
          s +
          x.amount -
          (x.returns || [])
            .filter(through)
            .reduce((n: number, r: RecordRow) => n + r.amount, 0),
        0,
      ) -
    d.transfers.filter(through).reduce((s, x) => s + x.amount, 0);
  return {
    month: m,
    rows,
    food,
    totalMeals: units.reduce((a, b) => a + b, 0) / 2,
    unallocated,
    cash,
    totalCosts: costs.reduce((a, b) => a + b, 0),
  };
}
export function action(
  input: Ledger,
  kind: string,
  p: RecordRow,
  a: Actor,
  now = new Date(),
): Ledger {
  const d = structuredClone(input),
    today = bdDay(now),
    at = now.toISOString(),
    id = () => randomUUID();
  let description = "";
  const manager = () => {
    if (!a.manager && !a.admin)
      throw new DomainError("Manager access required", 403);
  };
  const admin = () => {
    if (!a.admin) throw new DomainError("Admin access required", 403);
  };
  const open = (date: string) => {
    if (d.legacy?.cutover && date.slice(0, 7) < d.legacy.cutover)
      reject("Legacy history is read-only");
    if (d.closed[date.slice(0, 7)]) reject("Month is finalized");
    if (Object.keys(d.closed).some((m) => m > date.slice(0, 7)))
      reject("A later month is finalized; historical gaps are locked");
  };
  const member = (memberId: unknown, date?: string) => {
    const m = d.members.find((x) => x.id === memberId);
    if (!m) return reject("Member not found");
    if (date && !eligible(m, date)) reject("Member is not active on this date");
    return m;
  };
  const own = (m: Member) => {
    if (!a.admin && !a.manager && m.id !== a.memberId)
      throw new DomainError("Only your own record can be changed", 403);
  };
  const notify = (memberId: string, message: string, sendExternal = false) => {
    const event = id();
    d.notifications.push({
      id: event,
      memberId,
      message,
      at,
      read: false,
      target: kind.startsWith("deposit")
        ? "deposits"
        : kind.includes("correction")
          ? "meals"
          : kind === "close"
            ? "settlement"
            : kind === "manager"
              ? "activity"
              : "bazar",
      event: kind,
    });
    if (sendExternal)
      d.outbox.push({
        id: event,
        memberId,
        channel: "email",
        message,
        status: "queued",
        attempts: 0,
        at,
      });
  };
  const realDate = (v: unknown) => {
    const date = day(v);
    open(date);
    if (date > today) reject("Money cannot be recorded in the future");
    return date;
  };
  if (kind === "settings") {
    admin();
    d.name = text(p.name, 80);
    d.location =
      typeof p.location === "string" ? p.location.trim().slice(0, 150) : "";
    description = "Updated mess profile";
  } else if (kind === "rules") {
    admin();
    const effective = month(p.effective);
    if (
      effective < today.slice(0, 7) ||
      d.closed[effective] ||
      d.expenses.some((e) => e.date.startsWith(effective)) ||
      d.meals.some((e) => e.date.startsWith(effective))
    )
      reject("Set rules for a month without recorded meals or expenses");
    const weights = z
      .object({
        breakfast: z.number().int().min(1).max(4),
        lunch: z.number().int().min(1).max(4),
        dinner: z.number().int().min(1).max(4),
      })
      .parse(p.weights);
    const categories = z
      .record(
        z.string().min(1).max(40),
        z.enum(["meal", "equal", "occupancy", "fixed"]),
      )
      .parse(p.categories);
    d.rules = d.rules.filter((r) => r.effective !== effective);
    d.rules.push({
      effective,
      weights,
      categories,
      half: p.half === true,
      guests: p.guests === true,
    });
    description = `Set accounting rules effective ${effective}`;
  } else if (kind === "manager") {
    admin();
    const target = member(p.memberId, today),
      m = month(p.month);
    if (m < today.slice(0, 7) || d.closed[m])
      reject("Assign a manager for this month or a future month");
    const snapshot = settlement(d, today.slice(0, 7));
    d.managers[m] = target.id;
    description = `Manager ${m}: ${target.name}; handover cash ${snapshot.cash}, pending deposits ${d.deposits.filter((x) => x.status === "pending").length}, pending expenses ${d.expenses.filter((x) => x.status === "pending").length}; stock ${JSON.stringify(d.stock)}`;
    notify(target.id, `You are manager for ${m}. Review the handover audit.`);
  } else if (kind === "member_leave") {
    admin();
    const m = member(p.memberId),
      left = day(p.date);
    open(left);
    if (left < m.joined) reject("Leaving precedes joining");
    if (m.userId === a.userId) reject("The admin cannot leave their own mess");
    if (
      d.meals.some(
        (x) =>
          x.memberId === m.id && x.date > left && slots.some((k) => x[k] > 0),
      )
    )
      reject("Cancel future meal bookings first");
    m.left = left;
    description = `Member ${m.name} left on ${left}. ${text(p.reason)}`;
  } else if (kind === "account") {
    manager();
    const provider = z.enum(["bKash", "Nagad", "Rocket"]).parse(p.provider);
    const number = z
      .string()
      .regex(/^01\d{9,10}$/)
      .parse(p.number);
    const qr = typeof p.qr === "string" ? p.qr : undefined;
    d.accounts = d.accounts.filter((x) => x.provider !== provider);
    d.accounts.push({
      provider,
      number,
      name: text(p.name, 80),
      instructions: text(p.instructions, 300),
      enabled: p.enabled === true,
      ...(qr ? { qr } : {}),
    });
    description = `Updated ${provider} receiving account`;
  } else if (kind === "deposit_submit" || kind === "deposit_cash") {
    const cash = kind === "deposit_cash";
    if (cash) manager();
    const date = realDate(p.date),
      m = member(p.memberId);
    if (date < m.joined) reject("Deposit precedes joining");
    if (!cash) own(m);
    const amount = taka(p.amount);
    let wallet: RecordRow = { provider: "cash" };
    if (!cash) {
      const account = d.accounts.find(
        (x) => x.enabled && x.provider === p.provider,
      );
      if (!account) reject("This wallet is not enabled");
      const transactionId = z
        .string()
        .trim()
        .min(6)
        .max(40)
        .regex(/^[a-zA-Z0-9-]+$/)
        .parse(p.transactionId)
        .toUpperCase();
      if (
        d.deposits.some(
          (x) => x.provider === p.provider && x.transactionId === transactionId,
        )
      )
        reject("Transaction reference already submitted");
      if (
        d.deposits.filter((x) => x.memberId === m.id && x.status === "pending")
          .length >= 10
      )
        reject("Too many pending deposits");
      wallet = {
        provider: p.provider,
        transactionId,
        recipient: account!.number,
      };
    }
    const record = {
      id: id(),
      date,
      memberId: m.id,
      amount,
      ...wallet,
      note: typeof p.note === "string" ? p.note.slice(0, 300) : "",
      status: cash ? "approved" : "pending",
      submittedAt: at,
      submittedBy: a.userId,
      ...(cash ? { reviewedAt: at, reviewedBy: a.userId } : {}),
    };
    d.deposits.push(record);
    if (cash)
      notify(
        m.id,
        `Cash deposit ৳${(amount / 100).toFixed(2)} confirmed.`,
        true,
      );
    description = `${cash ? "Confirmed cash" : "Submitted wallet"} deposit ${record.id}: ${amount} paisa`;
  } else if (kind === "deposit_review") {
    manager();
    const r = d.deposits.find((x) => x.id === p.id);
    if (!r) reject("Deposit not found");
    open(r!.date);
    if (r!.status !== "pending") reject("Deposit already reviewed");
    const status = z.enum(["approved", "rejected"]).parse(p.status);
    if (status === "approved" && p.verified !== true)
      reject(
        "Confirm transaction ID, recipient and amount match wallet history",
      );
    const reason = text(p.reason, 300);
    Object.assign(r!, { status, reason, reviewedAt: at, reviewedBy: a.userId });
    notify(
      r!.memberId,
      `Your ${r!.provider} deposit ৳${(r!.amount / 100).toFixed(2)} was ${status}. Ref ${r!.transactionId}.`,
      true,
    );
    description = `Deposit ${r!.id} ${status}: ${reason}`;
  } else if (kind === "deposit_void") {
    manager();
    const r = d.deposits.find((x) => x.id === p.id);
    if (!r || r.status !== "approved")
      reject("Only an approved deposit may be voided");
    open(r!.date);
    r!.status = "voided";
    r!.reason = text(p.reason);
    r!.reviewedAt = at;
    r!.reviewedBy = a.userId;
    notify(r!.memberId, `Deposit reversed: ${r!.reason}`, true);
    description = `Voided ${r!.id}: ${r!.reason}`;
  } else if (kind === "menu") {
    manager();
    const date = day(p.date);
    open(date);
    if (date < today) reject("Publish a current or future menu");
    const v: RecordRow = { date };
    for (const s of slots) {
      const r = z
        .object({
          enabled: z.boolean(),
          menu: z.string().trim().max(150),
          cutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          serving: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        })
        .parse(p[s]);
      if (r.enabled && !r.menu) reject("Menu is required when serving");
      if (r.cutoff > r.serving)
        reject("Booking cutoff must not follow serving time");
      if (!r.enabled && d.meals.some((x) => x.date === date && x[s] > 0))
        reject("Correct existing bookings before cancelling service");
      v[s] = r;
    }
    d.menus = d.menus.filter((x) => x.date !== date);
    d.menus.push(v);
    description = `Published menu ${date}: ${JSON.stringify(v)}`;
  } else if (kind === "meal" || kind === "meal_range" || kind === "recurring") {
    const start = day(p.start || p.date),
      end = day(p.end || p.date || p.start);
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    if (days < 1 || days > 62) reject("Choose 1–62 days");
    const m = member(p.memberId);
    own(m);
    const weekdays =
      kind === "recurring"
        ? z.array(z.number().int().min(0).max(6)).min(1).parse(p.weekdays)
        : null;
    let changed = 0;
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.parse(start) + i * 86400000)
        .toISOString()
        .slice(0, 10);
      if (weekdays && !weekdays.includes(new Date(date).getUTCDay())) continue;
      open(date);
      member(m.id, date);
      const old = d.meals.find((x) => x.memberId === m.id && x.date === date);
      if (weekdays && old) continue;
      const rule = ruleFor(d, date.slice(0, 7)),
        plan = d.menus.find((x) => x.date === date),
        v: RecordRow = {
          id: old?.id || id(),
          memberId: m.id,
          date,
          weights: rule.weights,
          source: weekdays ? "recurring" : "explicit",
        };
      for (const s of slots) {
        const n = Number(p[s]);
        if (
          !Number.isFinite(n) ||
          n < 0 ||
          n > 20 ||
          !Number.isInteger(n * 2) ||
          (!rule.half && !Number.isInteger(n)) ||
          (!rule.guests && n > 1)
        )
          reject("Meal counts must follow half/guest policy (0–20)");
        v[s] = n * 2;
        if (plan && !plan[s].enabled && n > 0)
          reject(`${s} is not served on ${date}`);
        if (
          !a.manager &&
          !a.admin &&
          v[s] !== (old?.[s] || 0) &&
          (date < today ||
            (date === today && bdTime(now) >= (plan?.[s].cutoff || "10:00")))
        )
          reject(`${s} booking is past its deadline`);
      }
      if ((a.manager || a.admin) && date < today && !p.reason)
        reject("A reason is required for historical corrections");
      d.meals = d.meals.filter(
        (x) => !(x.memberId === m.id && x.date === date),
      );
      d.meals.push(v);
      changed++;
    }
    if (weekdays)
      d.recurrences.push({
        id: id(),
        memberId: m.id,
        start,
        end,
        weekdays,
        at,
        counts: Object.fromEntries(slots.map((s) => [s, Number(p[s])])),
      });
    description = `${kind}: ${m.name}, ${start} through ${end}, ${changed} days; ${p.reason || "member booking"}`;
  } else if (kind === "correction_request") {
    const m = member(p.memberId);
    own(m);
    const date = day(p.date);
    open(date);
    d.corrections.push({
      id: id(),
      memberId: m.id,
      date,
      reason: text(p.reason),
      counts: z
        .object({
          breakfast: z.number().min(0).max(20),
          lunch: z.number().min(0).max(20),
          dinner: z.number().min(0).max(20),
        })
        .parse(p.counts),
      status: "pending",
      at,
    });
    description = `Meal correction requested by ${m.name}`;
  } else if (kind === "correction_review") {
    manager();
    const r = d.corrections.find((x) => x.id === p.id);
    if (!r || r.status !== "pending") reject("No pending correction");
    open(r!.date);
    const reason = text(p.reason);
    if (p.approve === true) {
      const revised = action(
        d,
        "meal",
        { ...r!.counts, date: r!.date, memberId: r!.memberId, reason },
        a,
        now,
      );
      Object.assign(d, revised);
    }
    const target = d.corrections.find((x) => x.id === p.id)!;
    target.status = p.approve === true ? "approved" : "rejected";
    target.reviewNote = reason;
    notify(target.memberId, `Meal correction ${target.status}: ${reason}`);
    description = `Correction ${p.id}: ${target.status}`;
  } else if (kind === "duty") {
    manager();
    const date = day(p.date),
      m = member(p.memberId, date);
    const items = text(p.items, 1500);
    d.duties.push({
      id: id(),
      date,
      memberId: m.id,
      items,
      status: "assigned",
    });
    notify(m.id, `Bazar duty on ${date}: ${items}`);
    description = `Assigned bazar to ${m.name} on ${date}`;
  } else if (kind === "duty_complete") {
    const r = d.duties.find((x) => x.id === p.id);
    if (!r) reject("Duty not found");
    own(member(r!.memberId));
    if (
      !d.expenses.some(
        (e) =>
          e.dutyId === r!.id &&
          e.paidBy === r!.memberId &&
          e.receipt &&
          e.status !== "rejected",
      )
    )
      reject(
        "Submit a linked bazar expense with a photo before completing this duty",
      );
    if (r!.status === "completed") reject("Duty already completed");
    r!.status = "completed";
    r!.completedAt = at;
    description = `Completed bazar duty ${r!.id}`;
  } else if (kind === "advance") {
    manager();
    const date = realDate(p.date),
      m = member(p.memberId, date);
    d.advances.push({
      id: id(),
      date,
      memberId: m.id,
      amount: taka(p.amount),
      returns: [],
      note: text(p.note),
    });
    description = `Issued bazar advance to ${m.name}`;
  } else if (kind === "advance_return") {
    manager();
    const date = realDate(p.date),
      r = d.advances.find((x) => x.id === p.id);
    if (!r) reject("Advance not found");
    if (date < r!.date) reject("Return precedes advance");
    const used = d.expenses
        .filter((x) => x.advanceId === r!.id && x.status !== "rejected")
        .reduce((s, x) => s + x.amount, 0),
      returned = r!.returns.reduce((s: number, x: any) => s + x.amount, 0),
      amount = taka(p.amount);
    if (amount > r!.amount - used - returned)
      reject("Return exceeds unspent advance");
    r!.returns.push({ date, amount });
    description = `Advance ${r!.id} returned ${amount} paisa`;
  } else if (kind === "expense") {
    const date = realDate(p.date),
      m = member(p.paidBy, date);
    own(m);
    const rule = ruleFor(d, date.slice(0, 7));
    const category = text(p.category, 40),
      split = rule.categories[category];
    if (!split) reject("Unknown category");
    const source = z.enum(["fund", "personal", "advance"]).parse(p.source),
      amount = taka(p.amount);
    let fixed: Record<string, number> | undefined;
    if (split === "fixed") {
      fixed = z.record(z.number().int().nonnegative()).parse(p.fixed);
      if (Object.values(fixed).reduce((x, y) => x + y, 0) !== amount)
        reject("Fixed paisa shares must equal the expense");
      for (const key of Object.keys(fixed)) member(key, date);
    }
    let advanceId;
    if (source === "advance") {
      const r = d.advances.find(
        (x) => x.id === p.advanceId && x.memberId === m.id,
      );
      if (!r || r.date > date) reject("Valid advance required");
      const used = d.expenses
        .filter((x) => x.advanceId === r!.id && x.status !== "rejected")
        .reduce((s, x) => s + x.amount, 0);
      if (
        used +
          amount +
          r!.returns.reduce((s: number, x: any) => s + x.amount, 0) >
        r!.amount
      )
        reject("Purchase exceeds available advance");
      advanceId = r!.id;
    }
    const items = Array.isArray(p.items)
      ? z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              quantity: z.number().positive(),
              unit: z.string().max(20),
              paisa: z.number().int().nonnegative(),
            }),
          )
          .max(100)
          .parse(p.items)
      : [];
    if (items.length && items.reduce((s, x) => s + x.paisa, 0) !== amount)
      reject("Item totals must match expense");
    let dutyId: string | undefined;
    if (p.dutyId) {
      const duty = d.duties.find(
        (x) => x.id === p.dutyId && x.memberId === m.id,
      );
      if (!duty || duty.status === "completed" || date < duty.date)
        reject("Choose an open bazar duty for this purchaser");
      dutyId = duty!.id;
    }
    if (
      (p.kind === "bazar" || category === "food" || items.length || dutyId) &&
      !p.receipt
    )
      reject("A bazar photo (JPG, PNG or WebP) is required");
    d.expenses.push({
      id: id(),
      dutyId,
      date,
      paidBy: m.id,
      title: text(p.title),
      amount,
      category,
      source,
      split,
      fixed,
      advanceId,
      items,
      receipt: typeof p.receipt === "string" ? p.receipt : undefined,
      status: "pending",
    });
    description = `Submitted expense ${p.title}, ${amount} paisa`;
  } else if (kind === "expense_question") {
    const r = d.expenses.find((x) => x.id === p.id);
    if (!r) reject("Expense not found");
    open(r!.date);
    if (r!.question && !r!.resolution)
      reject("This expense already has an unresolved question");
    r!.question = text(p.reason, 500);
    r!.questionBy = a.userId;
    r!.resolution = undefined;
    description = `Question on expense ${r!.id}: ${r!.question}`;
  } else if (kind === "expense_resolve") {
    manager();
    const r = d.expenses.find((x) => x.id === p.id);
    if (!r?.question || r.resolution) reject("No unresolved expense question");
    open(r!.date);
    r!.resolution = text(p.reason, 500);
    r!.resolvedBy = a.userId;
    description = `Resolved question on expense ${r!.id}: ${r!.resolution}`;
  } else if (kind === "expense_review") {
    manager();
    const r = d.expenses.find((x) => x.id === p.id);
    if (!r || r.status !== "pending")
      reject("Expense already reviewed or missing");
    open(r!.date);
    r!.status = z.enum(["approved", "rejected"]).parse(p.status);
    r!.reviewNote = text(p.reason);
    description = `Expense ${r!.id} ${r!.status}: ${r!.reviewNote}`;
  } else if (kind === "transfer") {
    manager();
    const date = realDate(p.date),
      m = member(p.memberId),
      type = z.enum(["refund", "reimbursement"]).parse(p.type),
      amount = taka(p.amount);
    if (type === "refund") {
      const due =
        settlement(d, date.slice(0, 7)).rows.find((x) => x.id === m.id)?.due ||
        0;
      if (amount > Math.max(0, -due)) reject("Refund exceeds member credit");
    } else {
      const paid =
        d.expenses
          .filter(
            (x) =>
              x.status === "approved" &&
              x.paidBy === m.id &&
              x.source === "personal" &&
              x.date <= date,
          )
          .reduce((s, x) => s + x.amount, 0) -
        d.transfers
          .filter((x) => x.memberId === m.id && x.type === "reimbursement")
          .reduce((s, x) => s + x.amount, 0);
      if (amount > paid)
        reject("Reimbursement exceeds unreimbursed personal purchases");
    }
    d.transfers.push({
      id: id(),
      memberId: m.id,
      date,
      type,
      amount,
      note: text(p.note),
    });
    description = `Recorded actual ${type} ${amount} paisa to ${m.name}`;
  } else if (kind === "stock_threshold") {
    manager();
    const name = text(p.name, 80),
      unit = text(p.unit, 20),
      minimum = z
        .number()
        .finite()
        .nonnegative()
        .max(100000)
        .parse(Number(p.minimum));
    d.stockThresholds = (d.stockThresholds || []).filter(
      (x) => x.name !== name || x.unit !== unit,
    );
    d.stockThresholds.push({ name, unit, minimum });
    description = "Updated low-stock threshold";
  } else if (kind === "stock") {
    manager();
    const date = realDate(p.date);
    const name = text(p.name, 80),
      unit = text(p.unit, 20),
      quantity = z
        .number()
        .finite()
        .refine((n) => n !== 0 && Math.abs(n) < 100000)
        .parse(Number(p.quantity));
    if (
      d.stock
        .filter((x) => x.name === name && x.unit === unit)
        .reduce((s, x) => s + x.quantity, 0) +
        quantity <
      0
    )
      reject("Stock cannot go negative");
    d.stock.push({ id: id(), date, name, unit, quantity, note: text(p.note) });
    description = `Stock ${name}: ${quantity} ${unit}. Quantity only; costs remain in expenses.`;
  } else if (kind === "notice") {
    manager();
    d.notices.unshift({
      id: id(),
      title: text(p.title, 100),
      body: text(p.body, 2000),
      at,
      author: a.name,
    });
    description = `Published notice ${p.title}`;
  } else if (kind === "notification_reconcile") {
    admin();
    const event = d.outbox.find((x) => x.id === p.id);
    if (!event || !["unknown", "sending"].includes(event.status))
      return reject("Only uncertain sends need reconciliation");
    event.resolution = text(p.reason, 500);
    event.resolvedAt = at;
    event.resolvedBy = a.userId;
    description = "Notification manually reconciled; original status retained";
  } else if (kind === "read_all_notifications") {
    d.notifications
      .filter((x) => x.memberId === a.memberId)
      .forEach((x) => {
        x.read = true;
      });
  } else if (kind === "read_notification") {
    const r = d.notifications.find(
      (x) => x.id === p.id && x.memberId === a.memberId,
    );
    if (!r) reject("Notification not found");
    r!.read = true;
    description = "Read notification";
  } else if (kind === "reopen") {
    admin();
    const m = month(p.month),
      snapshot = d.closed[m];
    if (!snapshot || snapshot.legacy)
      reject("Only a finalized MERN month may be reopened");
    if (Object.keys(d.closed).some((k) => k > m))
      reject(
        "A later finalized month depends on this balance; reopen latest months first",
      );
    const reason = text(p.reason, 500);
    d.versions ??= {};
    d.reopened ??= {};
    d.versions[m] ??= [];
    d.versions[m].push(structuredClone(snapshot));
    d.reopened[m] = {
      at,
      by: a.userId,
      reason,
      previousVersion: snapshot.version || 1,
    };
    delete d.closed[m];
    description = `Reopened ${m}: ${reason}; previous version preserved; later balances suspended`;
  } else if (kind === "close") {
    manager();
    const m = month(p.month);
    open(m);
    if (m >= today.slice(0, 7)) reject("Close only completed months");
    const earlier = [...d.expenses, ...d.deposits, ...d.meals].some(
      (x) =>
        x.date.slice(0, 7) < m &&
        (!d.legacy?.cutover || x.date.slice(0, 7) >= d.legacy.cutover) &&
        !d.closed[x.date.slice(0, 7)],
    );
    if (earlier) reject("Close earlier months with records first");
    if (
      [...d.expenses, ...d.deposits, ...d.corrections].some(
        (x) => x.date.startsWith(m) && x.status === "pending",
      )
    )
      reject("Resolve pending entries first");
    if (
      d.expenses.some(
        (x) => x.date.startsWith(m) && x.question && !x.resolution,
      )
    )
      reject("Resolve expense questions before closing");
    if (
      d.advances.some(
        (x) =>
          x.date.startsWith(m) &&
          x.amount !==
            x.returns.reduce((s: number, r: any) => s + r.amount, 0) +
              d.expenses
                .filter((e) => e.advanceId === x.id && e.status === "approved")
                .reduce((s, e) => s + e.amount, 0),
      )
    )
      reject("Reconcile bazar advances first");
    const report = settlement(d, m);
    if (report.unallocated) reject("Costs have no eligible meals or members");
    d.closed[m] = {
      ...report,
      at,
      by: a.userId,
      version: (d.versions?.[m]?.length || 0) + 1,
      correction: d.reopened?.[m],
    };
    if (d.reopened) delete d.reopened[m];
    for (const x of report.rows)
      notify(x.id, `${m} finalized. Balance due ৳${(x.due / 100).toFixed(2)}.`);
    description = `Finalized ${m}; snapshot locked, carry-forward from this snapshot`;
  } else reject("Unknown action");
  if (!["read_notification", "read_all_notifications"].includes(kind))
    d.audit.push({
      id: id(),
      at,
      actor: a.userId,
      name: a.name,
      action: kind,
      description,
      ...(["meal", "meal_range", "recurring", "correction_review"].includes(
        kind,
      )
        ? {
            before: input.meals.filter(
              (x) =>
                JSON.stringify(d.meals.find((y) => y.id === x.id)) !==
                JSON.stringify(x),
            ),
            after: d.meals.filter(
              (x) =>
                JSON.stringify(input.meals.find((y) => y.id === x.id)) !==
                JSON.stringify(x),
            ),
          }
        : {}),
    });
  if (Buffer.byteLength(JSON.stringify(d)) > 8_000_000)
    reject("Mess storage limit reached; export and archive before continuing");
  return d;
}
