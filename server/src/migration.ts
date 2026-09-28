import { createHash } from "node:crypto";
import { z } from "zod";
import { createLedger, month, slots, type Ledger } from "./domain.ts";
import { reconcile, type Ledger as OldLedger } from "../../lib/ledger.ts";

// D1 stores one ledger JSON per mess. Use an authenticated ledger export, never a public dump.
export function migrateLedger(
  source: unknown,
  options: {
    legacyId: string;
    cutover: string;
    ownerMemberId: string;
    ownerUserId: string;
    openingBalances: Record<string, number>;
  },
) {
  const old = z
    .object({
      name: z.string(),
      members: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          joined: z.string(),
        }),
      ),
      meals: z.array(z.any()),
      expenses: z.array(z.any()),
      deposits: z.array(z.any()),
      closed: z.record(z.any()),
      history: z.array(z.any()),
    })
    .passthrough()
    .parse(source) as OldLedger;
  month(options.cutover);
  const owner = old.members.find((x) => x.id === options.ownerMemberId);
  if (!owner) throw new Error("Explicit legacy owner member mapping required");
  if (
    Object.keys(options.openingBalances).some(
      (id) => !old.members.some((m) => m.id === id),
    ) ||
    Object.values(options.openingBalances).some((n) => !Number.isSafeInteger(n))
  )
    throw new Error(
      "Opening balances must use known member IDs and integer paisa",
    );
  if (old.members.some((m) => options.openingBalances[m.id] === undefined))
    throw new Error(
      "Every legacy member needs an explicitly reviewed opening balance (including zero)",
    );
  const dates = [
    ...old.meals,
    ...old.expenses,
    ...old.deposits,
    ...(old.payments || []),
  ].map((x) => x.date);
  if (dates.some((date) => date.slice(0, 7) >= options.cutover))
    throw new Error(
      "Cutover must follow all legacy records; stop writes and choose the next clean month",
    );
  const d = createLedger(old.name, { ...owner, userId: options.ownerUserId });
  d.members = old.members.map((m) => ({
    ...m,
    ...(m.id === owner.id ? { userId: options.ownerUserId } : {}),
  }));
  d.meals = old.meals.map((r) => ({
    ...r,
    ...Object.fromEntries(slots.map((s) => [s, r[s] * 2])),
    weights: { breakfast: 1, lunch: 1, dinner: 1 },
    source: "legacy",
  }));
  d.expenses = old.expenses.map((r) => ({
    ...r,
    split: r.category === "food" ? "meal" : "equal",
    legacyReceipt: r.receipt,
    receipt: undefined,
  }));
  const paymentById = new Map((old.payments || []).map((p) => [p.id, p]));
  d.deposits = old.deposits.map((r) => {
    const payment = r.paymentId ? paymentById.get(r.paymentId) : undefined;
    return {
      ...r,
      provider: payment?.provider || "cash",
      transactionId: payment?.transactionId,
      recipient: payment?.recipient,
      status: r.voided ? "voided" : "approved",
      submittedAt: payment?.submittedAt,
      reviewedBy: payment?.reviewedBy,
      reviewedAt: payment?.reviewedAt,
      reason: r.correctionReason || payment?.reviewNote,
    };
  });
  for (const p of old.payments || [])
    if (
      !old.deposits.some((x) => x.paymentId === p.id || x.id === p.depositId)
    ) {
      if (p.status === "approved")
        throw new Error(
          "Approved legacy payment is missing its deposit; reconcile before import",
        );
      d.deposits.push({ ...p, reason: p.reviewNote });
    }
  d.accounts = structuredClone(old.paymentAccounts || []);
  d.menus = (old.menus || []).map((m) => ({
    ...m,
    ...Object.fromEntries(
      slots.map((s, i) => [
        s,
        {
          ...m[s],
          serving:
            ["08:00", "13:00", "20:00"][i] > m[s].cutoff
              ? ["08:00", "13:00", "20:00"][i]
              : m[s].cutoff,
        },
      ]),
    ),
  }));
  d.audit = old.history.map((r, i) => ({
    id: `legacy-${i}`,
    at: r.at,
    actor: r.actor,
    name: r.actor,
    action: "legacy",
    description: r.action,
  }));
  const periods = [...new Set(dates.map((x) => x.slice(0, 7)))].sort();
  const reports: Record<string, any> = {};
  for (const m of periods) {
    const r = reconcile(old, m);
    reports[m] = {
      month: m,
      rows: r.rows.map((v) => ({
        ...v,
        units: v.meals * 2,
        cost: v.food + v.shared,
        opening: 0,
        deposits: v.deposit,
        payouts: 0,
      })),
      food: r.food,
      totalMeals: r.totalMeals,
      totalCosts: r.rows.reduce((s, v) => s + v.food + v.shared, 0),
      unallocated: r.totalMeals ? 0 : r.food,
      cash: r.cash,
      legacy: true,
    };
  }
  for (const [m, snapshot] of Object.entries(old.closed)) {
    d.closed[m] = {
      ...reports[m],
      month: m,
      at: snapshot.at,
      legacy: true,
      carryForward: false,
      rows: snapshot.rows.map((v) => ({
        ...v,
        units: v.meals * 2,
        cost: v.food + v.shared,
        opening: 0,
        deposits: v.deposit,
        payouts: 0,
      })),
    };
  }
  for (const rows of [d.expenses, d.deposits])
    for (const r of rows)
      if (!Number.isSafeInteger(r.amount) || r.amount < 0)
        throw new Error("Legacy money must be nonnegative integer paisa");
  for (const r of d.meals)
    for (const slot of slots)
      if (!Number.isSafeInteger(r[slot]) || r[slot] < 0)
        throw new Error("Invalid legacy meal units");
  const hash = createHash("sha256")
    .update(JSON.stringify(source))
    .digest("hex");
  d.legacy = {
    source: structuredClone(source),
    sourceHash: hash,
    legacyId: options.legacyId,
    cutover: options.cutover,
    reports,
    opening: old.members.map((m) => ({
      id: m.id,
      due: options.openingBalances[m.id],
    })),
    identityPolicy:
      "Explicit owner proof; subsequent claims require a new admin-issued, email-bound invitation",
    receiptsStatus:
      "References preserved; private R2 objects require separate verified copy",
  };
  d.audit.push({
    id: "migration",
    at: new Date().toISOString(),
    actor: options.ownerUserId,
    action: "migration",
    description: `Imported ${options.legacyId}; source SHA256 ${hash}; reviewed opening balances for ${options.cutover}`,
  });
  const report = {
    sourceHash: hash,
    members: { before: old.members.length, after: d.members.length },
    meals: { before: old.meals.length, after: d.meals.length },
    expenses: { before: old.expenses.length, after: d.expenses.length },
    deposits: {
      before: old.deposits.length,
      after: d.deposits.filter(
        (x) => x.status === "approved" || x.status === "voided",
      ).length,
    },
    snapshots: {
      before: Object.keys(old.closed).length,
      after: Object.keys(d.closed).length,
    },
    verifiedDepositPaisa: {
      before: old.deposits
        .filter((x) => !x.voided)
        .reduce((s, x) => s + x.amount, 0),
      after: d.deposits
        .filter((x) => x.status === "approved")
        .reduce((s, x) => s + x.amount, 0),
    },
    finalizedDuePaisa: {
      before: Object.values(old.closed)
        .flatMap((x) => x.rows)
        .reduce((s, x) => s + x.due, 0),
      after: Object.values(d.closed)
        .flatMap((x) => x.rows)
        .reduce((s: number, x: any) => s + x.due, 0),
    },
  };
  for (const [key, v] of Object.entries(report))
    if (typeof v === "object" && v.before !== v.after)
      throw new Error(`Reconciliation mismatch: ${key}`);
  if (Buffer.byteLength(JSON.stringify(d)) > 8_000_000)
    throw new Error(
      "Legacy archive exceeds aggregate capacity; separate archival storage is required",
    );
  return { data: d, report };
}
