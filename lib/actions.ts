import {
  reconcile,
  mealSlots,
  paymentProviders,
  type Ledger,
  type PaymentProvider,
  type DayMenu,
} from "./ledger";
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
  if (action === "payment_account") {
    manager();
    const provider = text(p.provider, "Provider") as PaymentProvider;
    if (!paymentProviders.includes(provider))
      fail("Choose bKash, Nagad or Rocket.");
    const number = text(p.number, "Receiving number", 12);
    if (!/^01\d{9,10}$/.test(number))
      fail("Enter a valid 11 or 12 digit receiving number.");
    const name = text(p.name, "Account holder", 80);
    const instructions = text(p.instructions, "Payment instructions", 300);
    const enabled = p.enabled === "yes";
    data.paymentAccounts = [
      ...(data.paymentAccounts || []).filter((a) => a.provider !== provider),
      { provider, number, name, instructions, enabled },
    ];
    description = `Updated ${provider} receiving account ${number}; ${enabled ? "enabled" : "disabled"}`;
  } else if (action === "payment_submit") {
    const d = date(p.date);
    open(d);
    if (d > today) fail("Payment date cannot be in the future.");
    const m = member(p.memberId, d);
    if (!auth.manager && m.id !== auth.memberId)
      fail("Submit only your own payments.");
    const account = data.paymentAccounts?.find(
      (a) => a.enabled && a.provider === p.provider,
    );
    if (!account)
      return fail("This payment method is not enabled. Contact the manager.");
    const transactionId = text(
      p.transactionId,
      "Transaction ID",
      40,
    ).toUpperCase();
    if (!/^[A-Z0-9-]{6,40}$/.test(transactionId))
      fail(
        "Enter the 6–40 character transaction ID from your payment confirmation.",
      );
    if (
      data.payments?.some(
        (x) =>
          x.provider === account.provider && x.transactionId === transactionId,
      )
    )
      fail(
        "This transaction ID has already been submitted. Check payment history.",
      );
    const sender = text(p.sender, "Sender number", 12);
    if (!/^01\d{9,10}$/.test(sender)) fail("Enter a valid sender number.");
    const a = amount(p.amount);
    if (
      (data.payments || []).filter(
        (x) => x.memberId === m.id && x.status === "pending",
      ).length >= 10
    )
      fail("You already have 10 payments awaiting review.");
    (data.payments ??= []).push({
      id: crypto.randomUUID(),
      memberId: m.id,
      provider: account.provider,
      transactionId,
      amount: a,
      date: d,
      senderLast4: sender.slice(-4),
      recipient: account.number,
      status: "pending",
      submittedAt: now.toISOString(),
      submittedBy: auth.email,
    });
    description = `${m.name} submitted ${account.provider} payment ${transactionId}: ৳${(a / 100).toFixed(2)}, awaiting verification`;
  } else if (action === "payment_review") {
    manager();
    const payment = data.payments?.find((x) => x.id === p.id);
    if (!payment) fail("Payment not found.");
    if (payment!.status !== "pending")
      fail("This payment has already been reviewed.");
    open(payment!.date);
    if (p.status !== "approved" && p.status !== "rejected")
      fail("Choose approve or reject.");
    const reviewNote = text(p.reviewNote, "Verification note", 300);
    if (p.status === "approved" && p.verified !== "on")
      fail("Confirm you verified this payment in the receiving account.");
    if (p.status === "approved") {
      const depositId = crypto.randomUUID();
      data.deposits.push({
        id: depositId,
        memberId: payment!.memberId,
        date: payment!.date,
        amount: payment!.amount,
        note: `${payment!.provider} · ${payment!.transactionId}`,
        paymentId: payment!.id,
      });
      payment!.depositId = depositId;
    }
    Object.assign(payment!, {
      status: p.status,
      reviewNote,
      reviewedAt: now.toISOString(),
      reviewedBy: auth.email,
    });
    description = `${p.status === "approved" ? "Verified" : "Rejected"} ${payment!.provider} ${payment!.transactionId}: ${reviewNote}`;
  } else if (action === "menu") {
    manager();
    const d = date(p.date);
    open(d);
    if (d < today) fail("Publish menus for today or a future date.");
    const plan = { date: d, updatedAt: now.toISOString() } as DayMenu;
    for (const slot of mealSlots) {
      const enabled = p[slot + "Enabled"] === "yes";
      const menu = enabled
        ? text(p[slot + "Menu"], `${slot} menu`, 150)
        : "Not served";
      const cutoff = text(p[slot + "Cutoff"], "Booking deadline", 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff))
        fail("Enter a valid booking deadline.");
      if (!enabled && data.meals.some((x) => x.date === d && x[slot] > 0))
        fail(
          `Existing ${slot} bookings must be corrected before cancelling service.`,
        );
      plan[slot] = { enabled, menu, cutoff };
    }
    data.menus = [...(data.menus || []).filter((x) => x.date !== d), plan];
    description = `Published menu ${d}: ${mealSlots.map((s) => `${s}: ${plan[s].menu}, deadline ${plan[s].cutoff}`).join("; ")}`;
  } else if (action === "meal_range") {
    const start = date(p.start),
      end = date(p.end);
    const days =
      Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (days < 1 || days > 31) fail("Choose a date range of 1–31 days.");
    const draft = structuredClone(data);
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.parse(start) + i * 86400000)
        .toISOString()
        .slice(0, 10);
      applyAction(draft, "meal", { ...p, date: d }, auth, now);
    }
    Object.assign(data, draft);
    description = `Scheduled meals from ${start} to ${end}`;
  } else if (action === "member") {
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
    const plan = data.menus?.find((x) => x.date === d);
    const existing = data.meals.find(
      (x) => x.memberId === m.id && x.date === d,
    );
    if (!auth.manager && !plan) {
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
    if (!auth.manager && m.id !== auth.memberId)
      fail("You can only update your own meals.");
    if (plan)
      for (const [i, slot] of mealSlots.entries()) {
        if (!plan[slot].enabled && counts[i] > 0)
          fail(`${slot} is not served on ${d}. Set its count to 0.`);
        const time = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(now);
        if (
          !auth.manager &&
          counts[i] !== (existing?.[slot] || 0) &&
          (d < today || (d === today && time >= plan[slot].cutoff))
        )
          fail(
            `${slot} changes for ${d} closed at ${plan[slot].cutoff} Bangladesh time.`,
          );
      }
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
      if (old.paymentId)
        fail(
          "Verified online deposits cannot be edited. Void with a reason if incorrect.",
        );
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
    const payment = data.payments?.find((x) => x.id === deposit!.paymentId);
    if (payment) {
      payment.status = "voided";
      payment.reviewNote = reason;
      payment.reviewedAt = now.toISOString();
      payment.reviewedBy = auth.email;
    }
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
    if (
      data.payments?.some(
        (x) => x.date.startsWith(month) && x.status === "pending",
      )
    )
      fail("Review pending payments before finalizing this month.");
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
