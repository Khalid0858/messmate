import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { persistentLimit } from "./rate-limit.ts";
import { dispatchNotifications } from "./notifications.ts";
import multer from "multer";
import mongoose from "mongoose";
import path from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Mess, User, Session, Ticket, Upload } from "./models.ts";
import { digest, token, hashPassword, verifyPassword } from "./security.ts";
import {
  action,
  createLedger,
  settlement,
  bdDay,
  DomainError,
  text,
  day,
  type Ledger,
  type Actor,
} from "./domain.ts";
import * as providers from "./providers.ts";
type Mailer = (to: string, subject: string, message: string) => Promise<void>;
export function createApp(
  options: { origin?: string; mailer?: Mailer; mailReady?: () => boolean } = {},
) {
  const app = express(),
    origin = options.origin || process.env.APP_URL || "http://localhost:5180",
    production = process.env.NODE_ENV === "production";
  const mail = options.mailer || providers.sendMail,
    mailReady = options.mailReady || providers.mailReady;
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      service: "messmate-api",
      version: "2.0.0",
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.RENDER_GIT_COMMIT ||
        process.env.GIT_COMMIT ||
        "local",
    }),
  );
  app.get("/api/ready", (_req, res) =>
    res
      .status(mongoose.connection.readyState === 1 ? 200 : 503)
      .json({
        database:
          mongoose.connection.readyState === 1 ? "ready" : "unavailable",
      }),
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", persistentLimit("api", 60000, 180));
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    )
      return res.status(403).json({ error: "Request origin rejected" });
    next();
  });
  const authLimiter = persistentLimit("auth", 15 * 60000, 30);
  app.use("/api/auth", authLimiter);
  const credentials = z.object({
    email: z
      .string()
      .trim()
      .email()
      .max(200)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(128),
  });
  const publicUser = (u: any) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    verified: u.verified,
    phone: u.phone || "",
    smsConsent: !!u.smsConsent,
  });
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
  };
  async function authenticate(req: Request, res: Response, next: NextFunction) {
    const raw = req.cookies.mm_session;
    if (typeof raw !== "string")
      return res.status(401).json({ error: "Sign in required" });
    const s = await Session.findOne({
      token: digest(raw),
      expiresAt: { $gt: new Date() },
    });
    if (!s) return res.status(401).json({ error: "Session expired" });
    const u = await User.findById(s.userId);
    if (!u || !u.verified || s.authVersion !== u.authVersion)
      return res.status(401).json({ error: "Session expired" });
    res.locals.user = u;
    res.locals.session = s;
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== s.csrf
    )
      return res.status(403).json({ error: "CSRF token rejected" });
    next();
  }
  async function createTicket(u: any, kind: "verify" | "reset") {
    const raw = token();
    await Ticket.create({
      token: digest(raw),
      userId: u._id,
      kind,
      expiresAt: new Date(
        Date.now() + (kind === "verify" ? 86400000 : 3600000),
      ),
    });
    await mail(
      u.email,
      kind === "verify"
        ? "Verify your MessMate account"
        : "Reset your MessMate password",
      `${origin}/${kind}?token=${raw}\nThis link expires and can be used once. If you did not request it, ignore this message.`,
    );
  }
  app.get("/api/auth/availability", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ registration: mailReady() });
  });
  app.post("/api/auth/register", async (req, res) => {
    if (!mailReady())
      throw new DomainError(
        "Email service is not configured; registration is not available yet.",
        503,
      );
    const p = credentials
      .extend({ name: z.string().trim().min(2).max(80) })
      .parse(req.body);
    let u = await User.findOne({ email: p.email });
    if (!u)
      u = await User.create({ ...p, password: await hashPassword(p.password) });
    if (!u.verified) await createTicket(u, "verify");
    res
      .status(202)
      .json({
        message:
          "If eligible, a verification email has been sent. Check your inbox.",
      });
  });
  app.post("/api/auth/resend", async (req, res) => {
    if (!mailReady()) throw new DomainError("Email service unavailable", 503);
    const email = z.string().email().parse(req.body.email).toLowerCase(),
      u = await User.findOne({ email });
    if (u && !u.verified) await createTicket(u, "verify");
    res
      .status(202)
      .json({ message: "If eligible, a verification email has been sent." });
  });
  app.post("/api/auth/verify", async (req, res) => {
    const raw = z.string().length(64).parse(req.body.token);
    await mongoose.connection.transaction(async (s) => {
      const t = await Ticket.findOneAndDelete(
        { token: digest(raw), kind: "verify", expiresAt: { $gt: new Date() } },
        { session: s },
      );
      if (!t) throw new DomainError("Link expired or already used");
      await User.updateOne(
        { _id: t.userId },
        { $set: { verified: true } },
        { session: s },
      );
    });
    res.json({ message: "Email verified. You can sign in." });
  });
  app.post("/api/auth/login", async (req, res) => {
    const p = credentials.parse(req.body),
      u = await User.findOne({ email: p.email }).select("+password");
    if (!u || !(await verifyPassword(p.password, u.password)))
      throw new DomainError("Email or password is incorrect", 401);
    if (!u.verified)
      throw new DomainError("Verify your email before signing in", 403);
    const raw = token(),
      csrf = token();
    await Session.create({
      token: digest(raw),
      csrf,
      userId: u._id,
      authVersion: u.authVersion,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    res
      .cookie("mm_session", raw, { ...cookie, maxAge: 7 * 86400000 })
      .json({ user: publicUser(u), csrf });
  });
  app.post("/api/auth/forgot", async (req, res) => {
    if (!mailReady()) throw new DomainError("Email service unavailable", 503);
    const email = z.string().email().parse(req.body.email).toLowerCase(),
      u = await User.findOne({ email });
    if (u?.verified) await createTicket(u, "reset");
    res
      .status(202)
      .json({ message: "If the account exists, a reset link has been sent." });
  });
  app.post("/api/auth/reset", async (req, res) => {
    const p = z
        .object({
          token: z.string().length(64),
          password: z.string().min(12).max(128),
        })
        .parse(req.body),
      password = await hashPassword(p.password);
    await mongoose.connection.transaction(async (s) => {
      const t = await Ticket.findOneAndDelete(
        {
          token: digest(p.token),
          kind: "reset",
          expiresAt: { $gt: new Date() },
        },
        { session: s },
      );
      if (!t) throw new DomainError("Link expired or already used");
      await User.updateOne(
        { _id: t.userId },
        { $set: { password }, $inc: { authVersion: 1 } },
        { session: s },
      );
      await Session.deleteMany({ userId: t.userId }, { session: s });
    });
    res
      .clearCookie("mm_session", cookie)
      .json({ message: "Password changed. Sign in again." });
  });
  app.get("/api/me", authenticate, (_req, res) =>
    res.json({
      user: publicUser(res.locals.user),
      csrf: res.locals.session.csrf,
    }),
  );
  app.post("/api/logout", authenticate, async (_req, res) => {
    await Session.deleteOne({ _id: res.locals.session._id });
    res.clearCookie("mm_session", cookie).json({ ok: true });
  });
  app.patch("/api/me", authenticate, async (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().regex(/^(\+8801\d{9})?$/),
        smsConsent: z.boolean(),
      })
      .parse(req.body);
    if (p.smsConsent && !p.phone)
      throw new DomainError("A Bangladesh phone number is required for SMS");
    await User.updateOne({ _id: res.locals.user._id }, { $set: p });
    res.json({ ok: true });
  });
  app.get("/api/messes", authenticate, async (_req, res) => {
    const id = String(res.locals.user._id),
      rows = await Mess.find({ userIds: id }).select(
        "data.name adminId revision",
      );
    res.json(
      rows.map((x) => ({
        id: String(x._id),
        name: x.data.name,
        admin: x.adminId === id,
      })),
    );
  });
  app.post("/api/messes", authenticate, async (req, res) => {
    const u = res.locals.user,
      id = String(u._id);
    if ((await Mess.countDocuments({ adminId: id })) >= 5)
      throw new DomainError("Maximum five owned messes");
    const data = createLedger(text(req.body.name, 80), {
      id: randomUUID(),
      userId: id,
      name: u.name,
      email: u.email,
      joined: bdDay(),
    });
    const m = await Mess.create({ adminId: id, userIds: [id], data });
    res.status(201).json({ id: String(m._id) });
  });
  async function access(req: Request, res: Response, next: NextFunction) {
    if (!mongoose.isValidObjectId(req.params.id))
      throw new DomainError("Mess not found", 404);
    const m = await Mess.findOne({
      _id: req.params.id,
      userIds: String(res.locals.user._id),
    });
    if (!m) throw new DomainError("Mess not found", 404);
    const u = res.locals.user,
      d = m.data as Ledger,
      member = d.members.find((x) => x.userId === String(u._id));
    const admin = m.adminId === String(u._id);
    const active = !!member && (!member.left || member.left >= bdDay());
    res.locals.mess = m;
    res.locals.actor = {
      userId: String(u._id),
      name: u.name,
      email: u.email,
      admin,
      manager:
        admin || (active && d.managers[bdDay().slice(0, 7)] === member?.id),
      memberId: member?.id,
    } satisfies Actor;
    res.locals.active = active;
    next();
  }
  const view = (m: any, a: Actor) => {
    const data = structuredClone(m.data as Ledger);
    data.invites = [];
    data.requests = [];
    if (data.legacy) data.legacy = { cutover: data.legacy.cutover };
    data.outbox = a.manager
      ? data.outbox.map(({ id, status, memberId, at, providerId }) => ({
          id,
          status,
          memberId,
          at,
          providerId,
        }))
      : [];
    data.notifications = data.notifications.filter(
      (x) => x.memberId === a.memberId,
    );
    return {
      id: String(m._id),
      revision: m.revision,
      data,
      role: a.admin ? "admin" : a.manager ? "manager" : "member",
      memberId: a.memberId,
    };
  };
  app.get("/api/messes/:id", authenticate, access, (_req, res) =>
    res.json(view(res.locals.mess, res.locals.actor)),
  );
  app.get(
    "/api/messes/:id/settlement/:month",
    authenticate,
    access,
    (req, res) => {
      const d = res.locals.mess.data;
      res.json(
        d.closed[String(req.params.month)] ||
          d.legacy?.reports?.[String(req.params.month)] ||
          settlement(d, String(req.params.month)),
      );
    },
  );
  app.post(
    "/api/messes/:id/actions",
    authenticate,
    access,
    async (req, res) => {
      const p = z
          .object({
            action: z.string().max(40),
            payload: z.record(z.unknown()),
            revision: z.number().int().nonnegative(),
            requestId: z.string().uuid(),
          })
          .parse(req.body),
        m = res.locals.mess,
        a = res.locals.actor as Actor;
      if (
        !res.locals.active &&
        !a.admin &&
        !["deposit_submit", "read_notification"].includes(p.action)
      )
        throw new DomainError("Inactive members have read-only access", 403);
      if (m.data.requests.includes(p.requestId)) return res.json(view(m, a));
      if (p.revision !== m.revision)
        throw new DomainError(
          "Another change was saved. Refresh and retry.",
          409,
        );
      for (const field of ["receipt", "qr"])
        if (p.payload[field]) {
          if (
            !(await Upload.exists({
              key: p.payload[field],
              messId: String(m._id),
            }))
          )
            throw new DomainError("Invalid private file reference");
        }
      const data = action(m.data, p.action, p.payload, a);
      data.requests.push(p.requestId);
      const saved = await Mess.findOneAndUpdate(
        { _id: m._id, revision: p.revision },
        { $set: { data }, $inc: { revision: 1 } },
        { new: true },
      );
      if (!saved)
        throw new DomainError(
          "Another change was saved. Refresh and retry.",
          409,
        );
      if (
        ["deposit_review", "deposit_cash", "deposit_void"].includes(p.action)
      ) {
        await dispatchNotifications(String(m._id));
        return res.json(view(await Mess.findById(m._id), a));
      }
      res.json(view(saved, a));
    },
  );
  app.post(
    "/api/messes/:id/invites",
    authenticate,
    access,
    async (req, res) => {
      const a = res.locals.actor as Actor;
      if (!a.admin) throw new DomainError("Admin access required", 403);
      const email = z
          .string()
          .email()
          .max(200)
          .parse(req.body.email)
          .toLowerCase(),
        m = res.locals.mess,
        raw = token(),
        d = structuredClone(m.data as Ledger);
      if (d.members.length >= 100)
        throw new DomainError("Member limit reached");
      d.invites = d.invites.filter(
        (x) => x.email !== email && x.expiresAt > Date.now(),
      );
      d.invites.push({
        email,
        token: digest(raw),
        expiresAt: Date.now() + 7 * 86400000,
      });
      d.audit.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: a.userId,
        name: a.name,
        action: "invite",
        description: `Invited ${email}`,
      });
      const result = await Mess.updateOne(
        { _id: m._id, revision: m.revision },
        { $set: { data: d }, $inc: { revision: 1 } },
      );
      if (!result.modifiedCount)
        throw new DomainError("Refresh and retry", 409);
      res.json({
        url: `${origin}/invite?mess=${m._id}&token=${raw}`,
        expiresInDays: 7,
      });
    },
  );
  app.post("/api/invites/accept", authenticate, async (req, res) => {
    const p = z
        .object({
          mess: z.string().refine(mongoose.isValidObjectId),
          token: z.string().length(64),
        })
        .parse(req.body),
      m = await Mess.findById(p.mess),
      u = res.locals.user;
    if (!m) throw new DomainError("Invitation not found");
    const d = structuredClone(m.data as Ledger),
      invite = d.invites.find(
        (x) =>
          x.token === digest(p.token) &&
          x.email === u.email &&
          x.expiresAt > Date.now(),
      );
    if (!invite)
      throw new DomainError(
        "Invitation expired or belongs to another verified email",
      );
    let member = d.members.find((x) => x.email === u.email);
    if (member?.userId && member.userId !== String(u._id))
      throw new DomainError("Member already claimed");
    if (member) member.userId = String(u._id);
    else {
      if (d.members.length >= 100)
        throw new DomainError("Member limit reached");
      d.members.push({
        id: randomUUID(),
        userId: String(u._id),
        name: u.name,
        email: u.email,
        joined: bdDay(),
      });
    }
    d.invites = d.invites.filter((x) => x.token !== invite.token);
    d.audit.push({
      at: new Date().toISOString(),
      actor: String(u._id),
      name: u.name,
      action: "join",
      description: "Accepted invitation with verified email",
    });
    const saved = await Mess.updateOne(
      { _id: m._id, revision: m.revision },
      {
        $set: { data: d },
        $addToSet: { userIds: String(u._id) },
        $inc: { revision: 1 },
      },
    );
    if (!saved.modifiedCount) throw new DomainError("Refresh and retry", 409);
    res.json({ id: String(m._id) });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/messes/:id/files",
    authenticate,
    access,
    upload.single("file"),
    async (req, res) => {
      if (!res.locals.active) throw new DomainError("Inactive member", 403);
      const f = req.file;
      if (!f) throw new DomainError("File required");
      const b = f.buffer,
        mime = f.mimetype,
        valid =
          mime === "image/png"
            ? b
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : mime === "image/jpeg"
              ? b[0] === 255 && b[1] === 216 && b[2] === 255
              : mime === "application/pdf"
                ? b.subarray(0, 5).toString() === "%PDF-"
                : mime === "image/webp"
                  ? b.subarray(0, 4).toString() === "RIFF" &&
                    b.subarray(8, 12).toString() === "WEBP"
                  : false;
      if (!valid)
        throw new DomainError(
          "Upload JPG, PNG, WebP or PDF with matching file content",
        );
      const key = String(res.locals.mess._id) + "/" + randomUUID();
      await providers.putFile(key, b, mime);
      await Upload.create({
        key,
        messId: String(res.locals.mess._id),
        ownerId: String(res.locals.user._id),
        contentType: mime,
        size: b.length,
      });
      res.status(201).json({ key });
    },
  );
  app.get(
    "/api/messes/:id/files/:file",
    authenticate,
    access,
    async (req, res) => {
      const key = String(req.params.id) + "/" + String(req.params.file),
        record = await Upload.findOne({ key, messId: String(req.params.id) });
      if (!record) throw new DomainError("File not found", 404);
      const file = await providers.getFile(key);
      res.set({
        "Content-Type": record.contentType,
        "Content-Disposition": "attachment",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      });
      res.send(Buffer.from(await file.Body!.transformToByteArray()));
    },
  );
  app.get("/api/messes/:id/export", authenticate, access, (_req, res) => {
    if (!res.locals.actor.admin)
      throw new DomainError("Admin access required", 403);
    const data = structuredClone(res.locals.mess.data);
    data.invites = [];
    data.requests = [];
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="messmate-backup.json"',
    );
    res.json({ schemaVersion: 2, exportedAt: new Date().toISOString(), data });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  const client = path.resolve(import.meta.dirname, "../../client/dist");
  if (existsSync(client)) {
    app.use(express.static(client, { maxAge: "1h" }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(client, "index.html")),
    );
  }
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; "),
        });
    if (error instanceof DomainError)
      return res.status(error.status).json({ error: error.message });
    if (error.code === 11000)
      return res.status(409).json({ error: "Record already exists" });
    if (error.code === "LIMIT_FILE_SIZE")
      return res.status(413).json({ error: "File must be under 5 MB" });
    if (process.env.NODE_ENV === "test") console.error(error.stack);
    console.error(
      JSON.stringify({
        event: "request_error",
        name: error.name,
        code: error.code || "unknown",
      }),
    );
    res
      .status(500)
      .json({ error: "Request could not be completed. Please retry." });
  });
  return app;
}
