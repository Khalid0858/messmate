"use client";
import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Sun,
  Moon,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  bdToday,
  mealSlots,
  paymentProviders,
  type Ledger,
} from "@/lib/ledger";

type Props = {
  data: Ledger;
  manager: boolean;
  memberId: string;
  busy: boolean;
  demo: boolean;
  month: string;
  mutate: (
    action: string,
    payload: Record<string, unknown>,
  ) => Promise<unknown>;
};
const money = (n: number) =>
  "৳" +
  (n / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const stamp = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s))
    : "—";
function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  maxLength = 150,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="field">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={maxLength}
        {...(type === "number" ? { min: 0.01, step: 0.01, max: 10000000 } : {})}
      />
    </div>
  );
}
function Choice({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value} required>
        {children}
      </select>
    </div>
  );
}
function MemberChoice({
  data,
  manager,
  memberId,
}: {
  data: Ledger;
  manager: boolean;
  memberId: string;
}) {
  return (
    <Choice label="Member" name="memberId" value={memberId}>
      {data.members
        .filter((m) => manager || m.id === memberId)
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </Choice>
  );
}
export function PaymentCenter(props: Props) {
  const { data, manager, memberId, busy, demo, month, mutate } = props;
  const [dialog, setDialog] = useState(""),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("all");
  const accounts = data.paymentAccounts || [],
    payments = data.payments || [];
  const visible = payments.filter(
    (p) => p.date.startsWith(month) && (manager || p.memberId === memberId),
  );
  const activeAccount = accounts.find((a) => a.provider === selected),
    payment = payments.find((p) => p.id === selected);
  const open = (kind: string, id = "") => {
    setSelected(id);
    setError("");
    setDialog(kind);
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await mutate(
        dialog === "Configure account"
          ? "payment_account"
          : dialog === "Verify payment"
            ? "payment_review"
            : "payment_submit",
        payload,
      );
      setDialog("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="operations-stack">
      <section className="finance-banner">
        <div>
          <span className="eyebrow">MESS CONTRIBUTIONS</span>
          <h2>One fund. A clear record.</h2>
          <p>
            Send from your mobile wallet, submit the reference, and track
            verification here.
          </p>
        </div>
        <div className="banner-stat">
          <Wallet size={25} />
          <strong>
            {money(
              visible
                .filter((p) => p.status === "approved")
                .reduce((s, p) => s + p.amount, 0),
            )}
          </strong>
          <span>Verified online · {month}</span>
        </div>
      </section>
      <div className="provider-grid">
        {paymentProviders.map((provider) => {
          const a = accounts.find((x) => x.provider === provider);
          return (
            <section
              className={`provider-card provider-${provider.toLowerCase()}`}
              key={provider}
            >
              <div className="provider-heading">
                <span className="provider-mark">{provider.slice(0, 1)}</span>
                <h2>{provider}</h2>
                <span
                  className={`status-badge ${a?.enabled ? "approved" : "rejected"}`}
                >
                  {a?.enabled ? "Available" : "Not enabled"}
                </span>
              </div>
              <strong className="account-number">
                {a?.enabled ? a.number : "Awaiting setup"}
              </strong>
              <p>
                {a?.enabled ? a.name : "Manager adds the receiving account."}
              </p>
              {a?.enabled && (
                <p className="payment-instructions">{a.instructions}</p>
              )}
              <div className="row-actions">
                <Button
                  disabled={
                    !a?.enabled ||
                    demo ||
                    busy ||
                    !data.members.length ||
                    (!manager && !memberId)
                  }
                  onClick={() => open("Submit payment", provider)}
                >
                  Submit transaction <ArrowUpRight size={16} />
                </Button>
                {manager && (
                  <Button
                    variant="ghost"
                    onClick={() => open("Configure account", provider)}
                  >
                    Configure
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <div className="verification-note">
        <ShieldCheck size={22} />
        <p>
          <strong>Verified by your manager.</strong> MessMate never asks for
          your wallet PIN or OTP. Send money using your provider’s app and the
          manager’s instructions. A submitted transaction does not change your
          balance until approved.
        </p>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Payment history</h2>
            <p className="muted">
              {visible.filter((p) => p.status === "pending").length} awaiting
              review · Times in Bangladesh
            </p>
          </div>
          <select
            aria-label="Payment status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Member / provider",
                "Transaction",
                "Amount",
                "Submitted",
                "Status",
                "Review",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible
              .filter((p) => filter === "all" || p.status === filter)
              .slice()
              .reverse()
              .map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <strong>
                      {data.members.find((m) => m.id === p.memberId)?.name}
                    </strong>
                    <small>
                      {p.provider} · sender ••••{p.senderLast4}
                    </small>
                  </TableCell>
                  <TableCell>
                    <code>{p.transactionId}</code>
                    <small>
                      To {p.recipient} · paid {p.date}
                    </small>
                  </TableCell>
                  <TableCell>{money(p.amount)}</TableCell>
                  <TableCell>{stamp(p.submittedAt)}</TableCell>
                  <TableCell>
                    <span className={`status-badge ${p.status}`}>
                      {p.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.reviewNote && (
                      <>
                        <span>{p.reviewNote}</span>
                        <small>
                          {stamp(p.reviewedAt)} · {p.reviewedBy}
                        </small>
                      </>
                    )}
                    {manager && p.status === "pending" && (
                      <Button
                        variant="outline"
                        onClick={() => open("Verify payment", p.id)}
                      >
                        Verify
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {!visible.filter((p) => filter === "all" || p.status === filter)
          .length && (
          <div className="empty">
            <Wallet />
            <h3>No payments in this view</h3>
            <p>
              Submitted transactions and manager decisions will appear here.
            </p>
          </div>
        )}
      </section>
      <Dialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v && !busy) setDialog("");
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>{dialog}</DialogTitle>
            <DialogDescription>
              {dialog === "Verify payment"
                ? "Check the provider’s transaction history before crediting this member."
                : "Use the exact information from your wallet transaction."}
            </DialogDescription>
          </DialogHeader>
          <form className="entry-form" onSubmit={submit}>
            {dialog === "Configure account" && (
              <>
                <input type="hidden" name="provider" value={selected} />
                <Field
                  label={`${selected} receiving number`}
                  name="number"
                  value={activeAccount?.number}
                />
                <Field
                  label="Account holder name"
                  name="name"
                  value={activeAccount?.name}
                />
                <Field
                  label="Instructions (e.g. Send Money or merchant Payment)"
                  name="instructions"
                  value={activeAccount?.instructions}
                  maxLength={300}
                />
                <Choice
                  label="Availability"
                  name="enabled"
                  value={activeAccount?.enabled ? "yes" : "no"}
                >
                  <option value="no">Disabled</option>
                  <option value="yes">Enabled</option>
                </Choice>
                <p className="note">
                  Use an account you manage. Members will see this number and
                  instructions.
                </p>
              </>
            )}
            {dialog === "Submit payment" && (
              <>
                <div className="payment-destination">
                  <strong>
                    {selected} · {activeAccount?.number}
                  </strong>
                  <p>{activeAccount?.instructions}</p>
                </div>
                <input type="hidden" name="provider" value={selected} />
                <MemberChoice {...props} />
                <Field label="Amount sent (BDT)" name="amount" type="number" />
                <Field
                  label="Payment date"
                  name="date"
                  type="date"
                  value={bdToday()}
                />
                <Field
                  label="Transaction ID"
                  name="transactionId"
                  maxLength={40}
                />
                <Field
                  label="Sender wallet number"
                  name="sender"
                  type="tel"
                  maxLength={12}
                />
                <p className="note">
                  Only the final four digits of your sender number are saved.
                  Keep the provider’s receipt until verified.
                </p>
              </>
            )}
            {dialog === "Verify payment" && payment && (
              <>
                <input type="hidden" name="id" value={payment.id} />
                <div className="payment-destination">
                  <strong>
                    {money(payment.amount)} · {payment.provider}
                  </strong>
                  <p>
                    {payment.transactionId} · to {payment.recipient}
                  </p>
                  <p>
                    Paid {payment.date} · sender ends {payment.senderLast4}
                  </p>
                </div>
                <Choice label="Decision" name="status">
                  <option value="approved">Approve and credit deposit</option>
                  <option value="rejected">Reject — do not credit</option>
                </Choice>
                <Field
                  label="Verification note / rejection reason"
                  name="reviewNote"
                  maxLength={300}
                />
                <label className="confirm">
                  <input type="checkbox" name="verified" /> I matched the
                  transaction ID, amount and receiving account in my wallet
                  history (required to approve).
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || demo}>
              {busy
                ? "Saving…"
                : dialog === "Submit payment"
                  ? "Submit for verification"
                  : "Save decision"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MealPlanner(props: Props) {
  const { data, manager, memberId, busy, demo, mutate } = props;
  const [day, setDay] = useState(bdToday()),
    [dialog, setDialog] = useState(""),
    [error, setError] = useState("");
  const menu = data.menus?.find((m) => m.date === day),
    mine = data.meals.find((m) => m.memberId === memberId && m.date === day);
  const icons = [Coffee, Sun, Moon];
  const total = (slot: (typeof mealSlots)[number]) =>
    data.meals.filter((m) => m.date === day).reduce((s, m) => s + m[slot], 0);
  const week = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(day || bdToday()) + i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const open = (s: string) => {
    setError("");
    setDialog(s);
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      await mutate(dialog === "Publish menu" ? "menu" : "meal_range", payload);
      setDialog("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="operations-stack">
      <section className="planner-heading">
        <div>
          <span className="eyebrow">THE SHARED TABLE</span>
          <h2>Plan your plate.</h2>
          <p>See what’s cooking and choose the meals you’ll join.</p>
        </div>
        <div className="row-actions">
          <Button
            onClick={() => open("Schedule my meals")}
            disabled={
              demo || busy || !data.members.length || (!manager && !memberId)
            }
          >
            <CalendarDays size={17} /> Turn meals on / off
          </Button>
          {manager && (
            <Button variant="outline" onClick={() => open("Publish menu")}>
              Publish menu
            </Button>
          )}
        </div>
      </section>
      <div className="planner-date">
        <Label htmlFor="planner-date">Starting date</Label>
        <Input
          id="planner-date"
          type="date"
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
        <span>All deadlines use Bangladesh time (UTC+6).</span>
      </div>
      <div className="week-strip">
        {week.map((d) => (
          <button
            type="button"
            key={d}
            className={d === day ? "selected" : ""}
            onClick={() => setDay(d)}
          >
            <span>
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(d))}
            </span>
            <strong>{d.slice(8)}</strong>
            <small>
              {data.menus?.some((m) => m.date === d)
                ? "Menu ready"
                : "Not published"}
            </small>
          </button>
        ))}
      </div>
      <div className="meal-service-grid">
        {mealSlots.map((slot, i) => {
          const service = menu?.[slot],
            Icon = icons[i];
          return (
            <section className={`meal-service service-${slot}`} key={slot}>
              <div className="service-top">
                <span className="service-icon">
                  <Icon size={25} />
                </span>
                <span
                  className={`status-badge ${service?.enabled ? "approved" : "pending"}`}
                >
                  {service
                    ? service.enabled
                      ? "Serving"
                      : "Not served"
                    : "Awaiting menu"}
                </span>
              </div>
              <h2 className="capitalize">{slot}</h2>
              <p className="menu-title">
                {service?.menu ||
                  "Your manager has not published this menu yet."}
              </p>
              <div className="service-meta">
                <span>
                  <Clock3 size={16} /> Changes by {service?.cutoff || "10:00"}
                </span>
                <strong>{total(slot)} meals booked</strong>
              </div>
              {memberId && (
                <div className="my-booking">
                  <CheckCircle2 size={17} />
                  {mine?.[slot]
                    ? `You have ${mine[slot]} meal(s) booked`
                    : "Your meal is off"}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Kitchen headcount</h2>
          <span className="pill">{day}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {["Member", "Breakfast", "Lunch", "Dinner"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members
              .filter((m) => m.joined <= day)
              .map((m) => {
                const row = data.meals.find(
                  (x) => x.date === day && x.memberId === m.id,
                );
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.name}
                      {m.id === memberId && <small>You</small>}
                    </TableCell>
                    {mealSlots.map((s) => (
                      <TableCell key={s}>{row?.[s] || 0}</TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        <p className="note">
          Turning a meal on books that meal and includes it in the monthly meal
          count. Turn it off before the deadline if you won’t attend.
          Unpublished menus use the existing 10:00 AM cutoff.
        </p>
      </section>
      <Dialog
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v && !busy) setDialog("");
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>{dialog}</DialogTitle>
            <DialogDescription>
              {dialog === "Publish menu"
                ? "Decide which meals are served and when members must confirm."
                : "Choose a date range, then set each meal on or off. Existing counts in this range will be replaced."}
            </DialogDescription>
          </DialogHeader>
          <form className="entry-form" onSubmit={submit}>
            {dialog === "Publish menu" ? (
              <>
                <input type="hidden" name="date" value={day} />
                <p>
                  <strong>{day}</strong>
                </p>
                {mealSlots.map((s, i) => (
                  <fieldset className="slot-fieldset" key={s}>
                    <legend className="capitalize">{s}</legend>
                    <Choice
                      label={`${s} service`}
                      name={s + "Enabled"}
                      value={menu?.[s].enabled === false ? "no" : "yes"}
                    >
                      <option value="yes">Serving</option>
                      <option value="no">Not served</option>
                    </Choice>
                    <Field
                      label={`${s} menu`}
                      name={s + "Menu"}
                      value={menu?.[s].menu}
                      required={false}
                    />
                    <Field
                      label={`${s} booking deadline`}
                      name={s + "Cutoff"}
                      type="time"
                      value={menu?.[s].cutoff || ["07:00", "10:00", "16:00"][i]}
                    />
                  </fieldset>
                ))}
                <p className="note">
                  A meal with existing bookings cannot be cancelled until the
                  manager corrects those counts in Meal tracker.
                </p>
              </>
            ) : (
              <>
                <MemberChoice {...props} />
                <div className="form-two">
                  <Field label="From" name="start" type="date" value={day} />
                  <Field
                    label="Through (maximum 31 days)"
                    name="end"
                    type="date"
                    value={day}
                  />
                </div>
                {mealSlots.map((s) => (
                  <Choice
                    key={s}
                    label={s}
                    name={s}
                    value={String(mine?.[s] || 0)}
                  >
                    {Array.from({ length: 21 }, (_, i) => (
                      <option key={i} value={i}>
                        {i === 0
                          ? "Off — no meal"
                          : i === 1
                            ? "On — 1 meal"
                            : `On — ${i} meals (including guests)`}
                      </option>
                    ))}
                  </Choice>
                ))}
                <p className="note">
                  The whole request is saved together. If any date is closed,
                  unavailable or past its deadline, nothing in the range
                  changes.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || demo}>
              {busy
                ? "Saving…"
                : dialog === "Publish menu"
                  ? "Publish daily menu"
                  : "Save meal schedule"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
