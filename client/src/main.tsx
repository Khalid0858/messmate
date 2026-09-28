import React, { useState, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUpRight,
  UtensilsCrossed,
  Check,
  ShieldCheck,
  CalendarDays,
  Wallet,
  Users,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import { api } from "./api";
import { Workspace } from "./workspace";
import "./style.css";
const Language = createContext({
  bn: true,
  t: (en: string, bn: string) => bn,
  toggle: () => {},
});
export const useLanguage = () => useContext(Language);
function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [bn, setBn] = useState(localStorage.getItem("language") !== "en");
  return (
    <Language.Provider
      value={{
        bn,
        t: (en, b) => (bn ? b : en),
        toggle: () =>
          setBn((v) => {
            localStorage.setItem("language", v ? "en" : "bn");
            return !v;
          }),
      }}
    >
      {children}
    </Language.Provider>
  );
}
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span>
        <UtensilsCrossed size={22} />
      </span>
      messmate<span className="brand-period">.</span>
    </Link>
  );
}
export function Header() {
  const { t, bn, toggle } = useLanguage(),
    [open, setOpen] = useState(false);
  return (
    <header className="public-header">
      <Brand />
      <button
        className="icon-button mobile-only"
        aria-label={t("Toggle navigation", "নেভিগেশন খুলুন বা বন্ধ করুন")}
        aria-expanded={open}
        aria-controls="public-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav id="public-navigation" aria-label={t("Main navigation", "প্রধান নেভিগেশন")} className={open ? "open" : ""} onClick={() => setOpen(false)}>
        <Link to="/">{t("Home", "হোম")}</Link>
        <a href="/#features">{t("Features", "সুবিধা")}</a>
        <a href="/#how">{t("How it works", "যেভাবে কাজ করে")}</a>
        <a href="/#faq">{t("FAQ", "সাধারণ প্রশ্ন")}</a>
        <Link to="/contact">{t("Contact", "যোগাযোগ")}</Link>
        <button className="language" onClick={toggle}>
          {bn ? "English" : "বাংলা"}
        </button>
        <Link to="/login">{t("Log in", "লগইন")}</Link>
        <Link className="button dark" to="/register">
          {t("Create your mess", "আপনার মেস তৈরি করুন")}{" "}
          <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="public-footer">
      <div>
        <Brand />
        <p>
          {t(
            "Shared meals. Clear accounts. Better living.",
            "একসাথে খাওয়া। স্বচ্ছ হিসাব। সহজ জীবন।",
          )}
        </p>
      </div>
      <div>
        <Link to="/privacy">{t("Privacy", "গোপনীয়তা")}</Link>
        <Link to="/terms">{t("Terms", "ব্যবহারের নিয়ম")}</Link>
        <Link to="/contact">{t("Contact", "যোগাযোগ")}</Link>
      </div>
      <small>© {new Date().getFullYear()} Khalid Hasan. {t("All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।")} · MessMate · BDT / Asia-Dhaka</small>
    </footer>
  );
}
function Landing() {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-line" />{" "}
              {t("MADE FOR LIFE TOGETHER", "একসাথে থাকার হিসাব")}
            </span>
            <h1>
              {t("Good meals.", "ভালো খাবার।")}
              <br />
              <em>{t("Fair shares.", "ন্যায্য হিসাব।")}</em>
            </h1>
            <p>
              {t(
                "Your meals, bazar duties and mess fund—finally in one place. Less time checking the notebook. More time living.",
                "মিল, বাজারের পালা আর মেসের জমা—সব একই জায়গায়। খাতার হিসাব নিয়ে কম চিন্তা, একসাথে থাকার আনন্দ বেশি।",
              )}
            </p>
            <div className="hero-buttons">
              <Link className="button dark" to="/register">
                {t("Start a shared household", "আপনার মেস শুরু করুন")}
                <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" to="/login">
                {t("Already a member?", "আগেই সদস্য হয়েছেন?")}
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={18} />
              {t(
                "Private records. Transparent decisions.",
                "ব্যক্তিগত তথ্য সুরক্ষিত। প্রতিটি সিদ্ধান্তের ইতিহাস।",
              )}
            </div>
          </div>
          <div
            className="product-preview"
            aria-label="Illustrative example only"
          >
            <div className="preview-bar">
              <span className="logo-square">m.</span>
              <strong>Green House</strong>
              <span className="badge">
                {t("Illustrative preview", "নমুনা হিসাব")}
              </span>
            </div>
            <p className="eyebrow">YOUR MONTH, AT A GLANCE</p>
            <div className="preview-stats">
              <div>
                <small>Fund balance</small>
                <strong>৳8,450</strong>
              </div>
              <div>
                <small>Meal rate</small>
                <strong>৳62.50</strong>
              </div>
            </div>
            <div className="preview-chart">
              {[25, 45, 35, 70, 50, 95, 70, 85, 55, 95, 60, 80].map((v, i) => (
                <i key={i} style={{ height: v + "%" }} />
              ))}
            </div>
            <div className="preview-menu">
              <CalendarDays />
              <div>
                <strong>Tonight’s table</strong>
                <small>Rice, chicken curry & dal</small>
              </div>
              <span>12 meals</span>
            </div>
            <div className="floating-note">
              <Check size={18} />
              <div>
                <strong>A little clarity goes a long way.</strong>
                <small>Every entry has a history.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="feature-section" id="features">
          <div className="section-heading">
            <span className="eyebrow">
              {t("ONE HOUSEHOLD. ONE CLEAR VIEW.", "এক মেস। স্বচ্ছ হিসাব।")}
            </span>
            <h2>
              {t("Everything your mess runs on.", "মেস চালাতে যা প্রয়োজন।")}
            </h2>
          </div>
          <div className="feature-grid">
            {[
              [
                CalendarDays,
                t("Your plate, your plan", "নিজের মিল, নিজের পরিকল্পনা"),
                t(
                  "Daily menus, half meals, guests and booking deadlines.",
                  "দৈনিক মেনু, হাফ মিল, অতিথির মিল ও বুকিংয়ের সময়সীমা।",
                ),
              ],
              [
                Wallet,
                t("Every taka accounted for", "প্রতি টাকার হিসাব"),
                t(
                  "Cash or mobile wallet deposits, confirmed by your manager.",
                  "নগদ বা মোবাইল ব্যাংকিং জমা, ম্যানেজারের যাচাইসহ।",
                ),
              ],
              [
                Users,
                t("Share the responsibility", "দায়িত্ব ভাগ করে নিন"),
                t(
                  "Bazar duties, shopping advances and monthly manager handovers.",
                  "বাজারের পালা, অগ্রিম টাকা ও মাসিক ম্যানেজার পরিবর্তন।",
                ),
              ],
            ].map(([Icon, title, body], i) => {
              const I = Icon as typeof CalendarDays;
              return (
                <article key={i}>
                  <span className="feature-icon">
                    <I />
                  </span>
                  <h3>{title as string}</h3>
                  <p>{body as string}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="how-section" id="how">
          <div>
            <span className="eyebrow">
              {t("A SIMPLE ROUTINE", "সহজ দৈনন্দিন নিয়ম")}
            </span>
            <h2>
              {t(
                "From the first meal to month-end.",
                "প্রথম মিল থেকে মাসশেষের হিসাব।",
              )}
            </h2>
            <Link className="button light" to="/register">
              {t("Get started", "শুরু করুন")}
              <ArrowRight size={17} />
            </Link>
          </div>
          <ol>
            {[
              t(
                "Create your mess and invite verified members.",
                "মেস তৈরি করে যাচাইকৃত সদস্যদের আমন্ত্রণ দিন।",
              ),
              t(
                "Plan meals, assign bazar and record deposits.",
                "মিল পরিকল্পনা, বাজারের দায়িত্ব ও জমা লিখুন।",
              ),
              t(
                "Review, settle and carry the balance forward.",
                "যাচাই শেষে মাস বন্ধ করুন ও পরের মাসে জের নিন।",
              ),
            ].map((s, i) => (
              <li key={s}>
                <span>0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </section>
        <section className="faq" id="faq">
          <h2>{t("Before you move in.", "শুরু করার আগে।")}</h2>
          {[
            [
              t("Does MessMate transfer money?", "MessMate কি টাকা পাঠায়?"),
              t(
                "No. Send money in your wallet app to your manager’s configured number, then submit the reference under Deposits. Only confirmed deposits affect your balance.",
                "না। আপনার wallet app থেকে ম্যানেজারের দেওয়া নম্বরে টাকা পাঠিয়ে Deposits-এ reference জমা দিন। নিশ্চিত হওয়ার পরই balance যোগ হয়।",
              ),
            ],
            [
              t(
                "Can everyone see my mess records?",
                "সবাই কি মেসের তথ্য দেখতে পারে?",
              ),
              t(
                "The website is public; household records require sign-in and an accepted invitation.",
                "ওয়েবসাইট সবার জন্য খোলা; মেসের তথ্য দেখতে লগইন ও গৃহীত আমন্ত্রণ প্রয়োজন।",
              ),
            ],
            [
              t("Do all messes use the same rules?", "সব মেসে কি একই নিয়ম?"),
              t(
                "No. Your admin sets meal weights and cost-sharing rules. Finalized statements preserve the rules used.",
                "না। Admin মিলের ওজন ও খরচ ভাগের নিয়ম ঠিক করেন। চূড়ান্ত হিসাবের নিয়ম সংরক্ষিত থাকে।",
              ),
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Use at least 12 characters").max(128),
  name: z.string().optional(),
});
function Auth({ mode }: { mode: "login" | "register" }) {
  const { t } = useLanguage(),
    nav = useNavigate(),
    query = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(authSchema) });
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const availability = useQuery({
    queryKey: ["auth-availability"],
    queryFn: () => api("/auth/availability"),
    enabled: mode === "register",
    retry: false,
  });
  const registrationBlocked = mode === "register" &&
    (availability.isPending || availability.isError || !availability.data?.registration);
  return (
    <>
      <Header />
      <main className="auth-page">
        <section className="auth-story">
          <span className="eyebrow">MESSMATE / TOGETHER</span>
          <h1>
            {t("A place for every meal.", "প্রতিটি মিলের জন্য একটি জায়গা।")}
          </h1>
          <p>
            {t(
              "Keep your shared household organised—from the shopping list to the last taka.",
              "বাজারের তালিকা থেকে শেষ টাকার হিসাব—আপনার মেস রাখুন গোছানো।",
            )}
          </p>
          <UtensilsCrossed size={80} />
        </section>
        <section className="auth-card">
          <span className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : "MAKE YOURSELF AT HOME"}
          </span>
          <h2>
            {mode === "login"
              ? t("Sign in", "লগইন করুন")
              : t("Create an account", "অ্যাকাউন্ট তৈরি করুন")}
          </h2>
          {mode === "register" && availability.data?.registration === false && (
            <p className="error" role="status">
              {t("Registration is temporarily unavailable while email verification is being configured. Please return later.",
                "ইমেইল যাচাই সেবা চালু না হওয়ায় নতুন অ্যাকাউন্ট তৈরি সাময়িক বন্ধ আছে। অনুগ্রহ করে পরে আবার আসুন।")}
            </p>
          )}
          {mode === "register" && availability.isError && (
            <p className="error" role="alert">
              {t("Cannot check registration availability. Please reload and try again.", "সেবার অবস্থা যাচাই করা যাচ্ছে না। পেজ রিলোড করে আবার চেষ্টা করুন।")}
            </p>
          )}
          <form
            onSubmit={handleSubmit(async (values) => {
              setError("");
              setMessage("");
              try {
                const j = await api("/auth/" + mode, values);
                if (mode === "login") {
                  query.setQueryData(["me"], j);
                  nav("/app");
                } else setMessage(j.message);
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            {mode === "register" && (
              <label>
                {t("Full name", "আপনার নাম")}
                <input
                  {...register("name")}
                  minLength={2}
                  maxLength={80}
                  required
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              {t("Password", "পাসওয়ার্ড")}
              <input
                {...register("password")}
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={12}
              />
            </label>
            {Object.values(errors).map((e, i) => (
              <p className="error" key={i}>
                {e.message}
              </p>
            ))}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success" role="status">
                {message}
              </p>
            )}
            <button className="button dark" disabled={isSubmitting || registrationBlocked}>
              {isSubmitting
                ? t("Please wait…", "অপেক্ষা করুন…")
                : mode === "login"
                  ? t("Sign in", "লগইন")
                  : t("Create account", "অ্যাকাউন্ট তৈরি")}
            </button>
          </form>
          <p>
            <Link to={mode === "login" ? "/register" : "/login"}>
              {mode === "login"
                ? t("Create an account", "নতুন অ্যাকাউন্ট তৈরি করুন")
                : t("Already registered? Sign in", "অ্যাকাউন্ট আছে? লগইন করুন")}
            </Link>
          </p>
          <Link to="/forgot">
            {t("Forgot your password?", "পাসওয়ার্ড ভুলে গেছেন?")}
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
function TokenPage({
  mode,
}: {
  mode: "verify" | "reset" | "forgot" | "invite";
}) {
  const { t } = useLanguage();
  const [params] = useSearchParams(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    nav = useNavigate();
  useQuery({ queryKey: ["me"], queryFn: () => api("/me"), retry: false });
  return (
    <>
      <Header />
      <main className="narrow-page">
        <h1>
          {
            {
              verify: t("Verify email", "ইমেইল যাচাই করুন"),
              reset: t("Reset password", "নতুন পাসওয়ার্ড দিন"),
              forgot: t("Recover your account", "অ্যাকাউন্ট ফিরে পান"),
              invite: t("Join your mess", "মেসে যোগ দিন"),
            }[mode]
          }
        </h1>
        <p>
          {mode === "invite"
            ? t("Sign in with the invited, verified email address before accepting.", "আমন্ত্রণ গ্রহণের আগে আমন্ত্রিত যাচাইকৃত ইমেইল দিয়ে লগইন করুন।")
            : t("One-time links expire. Never share your reset link.", "লিংক একবার ব্যবহার করা যায় এবং মেয়াদ শেষে বন্ধ হয়। পাসওয়ার্ড পরিবর্তনের লিংক কাউকে দেবেন না।")}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const values = Object.fromEntries(new FormData(e.currentTarget));
              const j = await api(
                mode === "invite" ? "/invites/accept" : "/auth/" + mode,
                {
                  ...values,
                  token: params.get("token"),
                  mess: params.get("mess"),
                },
              );
              setMessage(j.message || "Invitation accepted");
              if (mode === "invite") nav("/app");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "forgot" && (
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          )}
          {mode === "reset" && (
            <label>
              {t("New password", "নতুন পাসওয়ার্ড")}
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <button className="button dark" disabled={busy}>
            {busy ? t("Please wait…", "অপেক্ষা করুন…") : t("Continue", "এগিয়ে যান")}
          </button>
          <Link to="/login">{t("Back to sign in", "লগইনে ফিরে যান")}</Link>
        </form>
      </main>
      <Footer />
    </>
  );
}
function Policy({ kind }: { kind: string }) {
  return (
    <>
      <Header />
      <main className="narrow-page">
        <h1>{kind}</h1>
        {kind === "Privacy" ? (
          <>
            <p>
              MessMate stores account details and records you submit to your
              household. Household members and authorised managers can access
              shared accounts. Phone numbers are used for transactional SMS only
              when you opt in.
            </p>
            <p>
              Session cookies support sign-in. Passwords are hashed. Receipt
              files are private. No wallet PIN or OTP is collected. Export
              requests and corrections should be directed to your mess admin.
              The hosting operator controls infrastructure retention and
              backups.
            </p>
          </>
        ) : kind === "Terms" ? (
          <>
            <p>
              Record accurate information and only invite authorised people.
              Managers must independently verify mobile wallet deposits before
              approving. MessMate records contributions; it does not transfer
              money or provide a payment guarantee.
            </p>
            <p>
              Review statements before finalising a month. Do not upload secrets
              or unrelated sensitive documents. Your mess's effective rules
              determine cost allocation.
            </p>
          </>
        ) : (
          <>
            <p>
              For meal, deposit or bill questions, contact your mess admin
              through the household notice board. For account or service
              problems, contact the operator who provided your deployment URL.
            </p>
            <Link to="/app">Open your mess workspace</Link>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
function PrivateApp() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    retry: false,
  });
  if (q.isPending) return <div className="loading">Loading your account…</div>;
  if (q.error) return <Navigate to="/login" replace />;
  return <Workspace user={q.data.user} />;
}
const query = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={query}>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            {(["verify", "reset", "forgot", "invite"] as const).map((m) => (
              <Route key={m} path={"/" + m} element={<TokenPage mode={m} />} />
            ))}
            <Route path="/app/*" element={<PrivateApp />} />
            {["Privacy", "Terms", "Contact"].map((m) => (
              <Route
                key={m}
                path={"/" + m.toLowerCase()}
                element={<Policy kind={m} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
