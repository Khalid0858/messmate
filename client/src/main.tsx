import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/noto-sans-bengali/bengali-400.css";
import "@fontsource/noto-sans-bengali/bengali-600.css";
import "@fontsource/noto-sans-bengali/bengali-700.css";
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
  useLocation,
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
import { api, ApiError, safeReturn } from "./api";
const Workspace = lazy(() =>
  import("./workspace").then((module) => ({ default: module.Workspace })),
);
import "./style.css";
import { useLanguage, LanguageProvider } from "./language";
import { Brand } from "./brand";
function Header() {
  const { t, bn, toggle } = useLanguage(),
    [open, setOpen] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    retry: false,
    retryOnMount: false,
    staleTime: 30000,
  });
  return (
    <header className="public-header">
      <a className="skip-link" href="#main-content">
        {t("Skip to content", "মূল অংশে যান")}
      </a>
      <Brand onNavigate={() => setOpen(false)} />
      <button
        className="icon-button mobile-only"
        aria-label={t("Toggle navigation", "নেভিগেশন খুলুন বা বন্ধ করুন")}
        aria-expanded={open}
        aria-controls="public-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav
        id="public-navigation"
        aria-label={t("Main navigation", "প্রধান নেভিগেশন")}
        className={open ? "open" : ""}
        onClick={() => setOpen(false)}
      >
        <Link to="/" onClick={() => window.scrollTo(0, 0)}>
          {t("Home", "হোম")}
        </Link>
        <a href="/#features">{t("Features", "সুবিধা")}</a>
        <a href="/#how">{t("How it works", "যেভাবে কাজ করে")}</a>
        <a href="/#faq">{t("FAQ", "সাধারণ প্রশ্ন")}</a>
        <Link to="/contact">{t("Contact", "যোগাযোগ")}</Link>
        <button className="language" onClick={toggle}>
          {bn ? "English" : "বাংলা"}
        </button>
        {me.isPending ? (
          <span role="status">
            {t("Checking account…", "অ্যাকাউন্ট যাচাই হচ্ছে…")}
          </span>
        ) : me.data?.user ? (
          <>
            <Link className="button dark" to="/app/overview">
              {t("Open dashboard", "ড্যাশবোর্ড খুলুন")}
            </Link>
            <details className="profile-menu">
              <summary>{me.data.user.name}</summary>
              <Link to="/app/settings">
                {t("Account settings", "অ্যাকাউন্ট সেটিংস")}
              </Link>
            </details>
          </>
        ) : me.data?.expired ||
          (me.error instanceof ApiError && me.error.status === 401) ? (
          <>
            <Link to="/login">{t("Log in", "লগইন")}</Link>
            <Link className="button dark" to="/register">
              {t("Create your mess", "আপনার মেস তৈরি করুন")}{" "}
              <ArrowUpRight size={16} />
            </Link>
          </>
        ) : (
          <button onClick={() => me.refetch()}>
            {t("Retry account check", "আবার অ্যাকাউন্ট যাচাই করুন")}
          </button>
        )}
      </nav>
    </header>
  );
}
function Footer() {
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
      <small>
        © {new Date().getFullYear()} Khalid Hasan.{" "}
        {t("All rights reserved.", "সর্বস্বত্ব সংরক্ষিত।")} · MessMate · BDT /
        Asia-Dhaka
      </small>
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
  const [params] = useSearchParams();
  const destination = safeReturn(params.get("returnTo"));
  const [showPassword, setShowPassword] = useState(false);
  const availability = useQuery({
    queryKey: ["auth-availability"],
    queryFn: () => api("/auth/availability"),
    enabled: mode === "register",
    retry: false,
  });
  const registrationBlocked =
    mode === "register" &&
    (availability.isPending ||
      availability.isError ||
      !availability.data?.registration);
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="auth-page">
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
              {t(
                "Registration is temporarily unavailable while email verification is being configured. Please return later.",
                "ইমেইল যাচাই সেবা চালু না হওয়ায় নতুন অ্যাকাউন্ট তৈরি সাময়িক বন্ধ আছে। অনুগ্রহ করে পরে আবার আসুন।",
              )}
            </p>
          )}
          {mode === "register" && availability.isError && (
            <p className="error" role="alert">
              {t(
                "Cannot check registration availability. Please reload and try again.",
                "সেবার অবস্থা যাচাই করা যাচ্ছে না। পেজ রিলোড করে আবার চেষ্টা করুন।",
              )}
            </p>
          )}
          <form
            onSubmit={handleSubmit(async (values) => {
              setError("");
              setMessage("");
              try {
                const j = await api("/auth/" + mode, {
                  ...values,
                  returnTo: destination,
                });
                if (mode === "login") {
                  query.clear();
                  query.setQueryData(["me"], j);
                  nav(destination, { replace: true });
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
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={12}
                aria-describedby="password-help"
              />
            </label>
            <p id="password-help">
              {t(
                "Use at least 12 characters.",
                "কমপক্ষে ১২ অক্ষর ব্যবহার করুন।",
              )}
            </p>
            <button
              type="button"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword
                ? t("Hide password", "পাসওয়ার্ড লুকান")
                : t("Show password", "পাসওয়ার্ড দেখুন")}
            </button>
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
            <button
              className="button dark"
              disabled={isSubmitting || registrationBlocked}
            >
              {isSubmitting
                ? t("Please wait…", "অপেক্ষা করুন…")
                : mode === "login"
                  ? t("Sign in", "লগইন")
                  : t("Create account", "অ্যাকাউন্ট তৈরি")}
            </button>
          </form>
          <p>
            <Link
              to={
                (mode === "login" ? "/register" : "/login") +
                "?returnTo=" +
                encodeURIComponent(destination)
              }
            >
              {mode === "login"
                ? t("Create an account", "নতুন অ্যাকাউন্ট তৈরি করুন")
                : t("Already registered? Sign in", "অ্যাকাউন্ট আছে? লগইন করুন")}
            </Link>
          </p>
          <Link to="/resend">
            {t("Resend verification email", "যাচাইয়ের ইমেইল আবার পাঠান")}
          </Link>
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
  mode: "verify" | "reset" | "forgot" | "invite" | "resend";
}) {
  const { t } = useLanguage();
  const [params] = useSearchParams(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    nav = useNavigate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    retry: false,
  });
  const [cooldown, setCooldown] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="narrow-page">
        <h1>
          {
            {
              resend: t(
                "Resend verification email",
                "যাচাইয়ের ইমেইল আবার পাঠান",
              ),
              verify: t("Verify email", "ইমেইল যাচাই করুন"),
              reset: t("Reset password", "নতুন পাসওয়ার্ড দিন"),
              forgot: t("Recover your account", "অ্যাকাউন্ট ফিরে পান"),
              invite: t("Join your mess", "মেসে যোগ দিন"),
            }[mode]
          }
        </h1>
        <p>
          {mode === "invite"
            ? t(
                "Sign in with the invited, verified email address before accepting.",
                "আমন্ত্রণ গ্রহণের আগে আমন্ত্রিত যাচাইকৃত ইমেইল দিয়ে লগইন করুন।",
              )
            : t(
                "One-time links expire. Never share your reset link.",
                "লিংক একবার ব্যবহার করা যায় এবং মেয়াদ শেষে বন্ধ হয়। পাসওয়ার্ড পরিবর্তনের লিংক কাউকে দেবেন না।",
              )}
        </p>
        {mode === "invite" && !me.data?.user && (
          <p>
            <Link
              to={
                "/login?returnTo=" +
                encodeURIComponent(location.pathname + location.search)
              }
            >
              {t(
                "Sign in to accept invitation",
                "আমন্ত্রণ গ্রহণ করতে লগইন করুন",
              )}
            </Link>
          </p>
        )}
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
              if (mode === "resend" || mode === "forgot") setCooldown(60);
              if (mode === "invite") nav("/app");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {(mode === "forgot" || mode === "resend") && (
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
                type={show ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
          )}
          {mode === "reset" && (
            <>
              <p>
                {t(
                  "Use at least 12 characters.",
                  "কমপক্ষে ১২ অক্ষর ব্যবহার করুন।",
                )}
              </p>
              <button type="button" onClick={() => setShow((v) => !v)}>
                {show
                  ? t("Hide password", "পাসওয়ার্ড লুকান")
                  : t("Show password", "পাসওয়ার্ড দেখুন")}
              </button>
            </>
          )}
          {error && (
            <p>
              <Link to={mode === "verify" ? "/resend" : "/forgot"}>
                {t("Request a new link", "নতুন লিংক নিন")}
              </Link>
            </p>
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
          <button
            className="button dark"
            disabled={
              busy || cooldown > 0 || (mode === "invite" && !me.data?.user)
            }
          >
            {busy
              ? t("Please wait…", "অপেক্ষা করুন…")
              : t("Continue", "এগিয়ে যান")}
          </button>
          {cooldown > 0 && <p role="status">{cooldown}s</p>}
          <Link
            to={
              "/login?returnTo=" +
              encodeURIComponent(safeReturn(params.get("returnTo")))
            }
          >
            {t("Back to sign in", "লগইনে ফিরে যান")}
          </Link>
        </form>
      </main>
      <Footer />
    </>
  );
}
function SupportForm() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const values = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const r = await api("/support", values);
          setMessage(
            t(
              r.message,
              "ইমেইল প্রদানকারী অনুরোধ গ্রহণ করেছে। এখনই আবার পাঠাবেন না।",
            ),
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{t("Private support request", "ব্যক্তিগত সহায়তার অনুরোধ")}</h2>
      <p>
        {t(
          "Sent to the service operator via email. Do not include passwords, OTPs, wallet PINs or private financial records. Up to two requests per hour.",
          "ইমেইলে সেবার পরিচালকের কাছে যাবে। Password, OTP, wallet PIN বা ব্যক্তিগত হিসাব দেবেন না। ঘণ্টায় সর্বোচ্চ দুটি অনুরোধ।",
        )}
      </p>
      <label>
        {t("Reply email", "উত্তরের ইমেইল")}
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label>
        {t("Subject", "বিষয়")}
        <input name="subject" required minLength={4} maxLength={100} />
      </label>
      <label>
        {t("Message", "বার্তা")}
        <textarea name="message" required minLength={15} maxLength={2000} />
      </label>
      <input
        className="honeypot"
        name="website"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button className="button dark" disabled={busy || !!message}>
        {t("Send support request", "সহায়তার অনুরোধ পাঠান")}
      </button>
    </form>
  );
}
function Policy({ kind }: { kind: string }) {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="narrow-page">
        <h1>
          {t(
            kind,
            (
              {
                Privacy: "গোপনীয়তা",
                Terms: "ব্যবহারের নিয়ম",
                Contact: "যোগাযোগ",
              } as Record<string, string>
            )[kind],
          )}
        </h1>
        {kind === "Privacy" ? (
          <>
            <p>
              {t(
                "MessMate stores your account and shared household records. Members and authorised managers can access their household records. SMS is currently disabled.",
                "মেসমেটে আপনার অ্যাকাউন্ট ও মেসের হিসাব সংরক্ষিত থাকে। সদস্য ও অনুমোদিত ম্যানেজার শুধু নিজ মেসের তথ্য দেখতে পারেন। বর্তমানে এসএমএস বন্ধ আছে।",
              )}
            </p>
            <p>
              {t(
                "Session cookies support sign-in; passwords are hashed and receipts are private. Wallet PINs and OTPs are never collected. Contact your mess admin for record exports or corrections. Encrypted backups are retained for 30 days. Vercel hosts the app and private receipt files, MongoDB Atlas stores account and ledger data, and Brevo processes transactional email. Financial history remains while the mess operates. Use Contact for account export, correction or deletion requests; identity is verified before acting. Shared financial records may require retention and cannot be silently erased.",
                "লগইনের জন্য session cookie ব্যবহৃত হয়; পাসওয়ার্ড hash করে রাখা হয় এবং রসিদ ব্যক্তিগত থাকে। ওয়ালেট PIN বা OTP কখনো চাওয়া হয় না। তথ্য ডাউনলোড বা সংশোধনের জন্য মেস অ্যাডমিনের সঙ্গে যোগাযোগ করুন। এনক্রিপ্টেড ব্যাকআপ ৩০ দিন রাখা হয়। Vercel-এ অ্যাপ ও ব্যক্তিগত রসিদ, MongoDB Atlas-এ অ্যাকাউন্ট ও হিসাব এবং Brevo দিয়ে ইমেইল পাঠানো হয়। মেস চালু থাকা অবস্থায় হিসাবের ইতিহাস সংরক্ষিত থাকে। অ্যাকাউন্টের তথ্য বা সংশোধন/মুছে ফেলার অনুরোধ Contact থেকে দিন; আগে পরিচয় যাচাই করা হবে। যৌথ আর্থিক রেকর্ড নীরবে মুছে ফেলা যায় না।",
              )}
            </p>
          </>
        ) : kind === "Terms" ? (
          <>
            <p>
              {t(
                "Enter accurate records and invite only authorised people. Managers must verify actual receipt of wallet deposits before approval. MessMate records contributions; it does not transfer funds or guarantee payments.",
                "সঠিক তথ্য লিখুন এবং শুধু অনুমোদিত সদস্যকে আমন্ত্রণ দিন। ম্যানেজার বাস্তবে টাকা পেয়েছেন যাচাই করে জমা অনুমোদন করবেন। মেসমেট জমার হিসাব রাখে; টাকা পাঠায় না এবং পেমেন্টের নিশ্চয়তা দেয় না।",
              )}
            </p>
            <p>
              {t(
                "Review statements before finalising a month. Do not upload secrets or unrelated sensitive documents. Your mess's effective rules determine allocation.",
                "মাস চূড়ান্ত করার আগে হিসাব যাচাই করুন। গোপন credential বা অপ্রাসঙ্গিক ব্যক্তিগত দলিল আপলোড করবেন না। আপনার মেসের কার্যকর নিয়মে খরচ ভাগ হবে।",
              )}
            </p>
          </>
        ) : (
          <>
            <p>
              {t(
                "For meal or bill questions, contact your mess admin directly. The notice board contains manager announcements. For account issues, use the private support form below.",
                "মিল বা বিলের প্রশ্নে সরাসরি মেস অ্যাডমিনকে জানান। নোটিশ বোর্ড ম্যানেজারের ঘোষণা দেখায়। অ্যাকাউন্টের সমস্যায় নিচের ব্যক্তিগত সহায়তা ফর্ম ব্যবহার করুন।",
              )}
            </p>
            <SupportForm />
            <p>
              <a href="https://github.com/Khalid0858/messmate">
                GitHub · MessMate
              </a>
            </p>
            <Link to="/app">
              {t("Open your mess workspace", "আপনার মেসের হিসাব খুলুন")}
            </Link>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
function PrivateApp() {
  const { t } = useLanguage();
  const loc = useLocation();
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    retry: false,
  });
  if (q.isPending)
    return (
      <div className="loading">
        {t("Loading your account…", "আপনার অ্যাকাউন্টের তথ্য আসছে…")}
      </div>
    );
  if (
    q.data?.expired ||
    (q.error instanceof ApiError && q.error.status === 401)
  )
    return (
      <Navigate
        to={"/login?returnTo=" + encodeURIComponent(loc.pathname + loc.search)}
        replace
      />
    );
  if (q.error)
    return (
      <>
        <Header />
        <main id="main-content" className="narrow-page">
          <h1>
            {t(
              "Account temporarily unavailable",
              "অ্যাকাউন্ট সাময়িকভাবে পাওয়া যাচ্ছে না",
            )}
          </h1>
          <p role="alert">
            {t(
              "Your session has not been deliberately ended. Please retry.",
              "সাময়িক সংযোগ সমস্যা। আবার চেষ্টা করুন।",
            )}
          </p>
          <button onClick={() => q.refetch()}>
            {t("Retry", "আবার চেষ্টা")}
          </button>
        </main>
      </>
    );
  return (
    <Suspense
      fallback={
        <div className="loading">
          {t("Loading workspace…", "মেসের হিসাব আসছে…")}
        </div>
      }
    >
      <Workspace user={q.data.user} />
    </Suspense>
  );
}
function NotFound() {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main id="main-content" className="narrow-page">
        <h1>404</h1>
        <p>{t("This page could not be found.", "এই পেজটি পাওয়া যায়নি।")}</p>
        <Link to="/">{t("Home", "হোম")}</Link> ·{" "}
        <Link to="/app/overview">{t("Dashboard", "ড্যাশবোর্ড")}</Link>
      </main>
      <Footer />
    </>
  );
}
function RouteEffects() {
  const loc = useLocation(),
    qc = useQueryClient();
  useEffect(() => {
    const expired = () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      qc.setQueryData(["me"], { user: null, expired: true });
    };
    window.addEventListener("messmate:expired", expired);
    return () => window.removeEventListener("messmate:expired", expired);
  }, [qc]);
  useEffect(() => {
    const privatePage =
      /^\/(app|login|register|verify|reset|forgot|resend|invite)(\/|$)/.test(
        loc.pathname,
      );
    document.title =
      loc.pathname === "/"
        ? "MessMate — Shared meals, clear accounts"
        : loc.pathname.split("/").filter(Boolean).at(-1) + " · MessMate";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.append(meta);
    }
    meta.content = privatePage ? "noindex, nofollow" : "index, follow";
    const descriptions: Record<string, string> = {
      "/": "Plan shared meals, record bazar and reconcile your mess fund.",
      "/contact": "Private support and contact information for MessMate.",
      "/privacy":
        "How MessMate stores account, receipt and shared household information.",
      "/terms": "Rules for using MessMate shared meal and expense records.",
    };
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description)
      description.content =
        descriptions[loc.pathname] || "Private MessMate account workspace.";
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) canonical.href = location.origin + loc.pathname;
    if (!loc.hash) {
      window.scrollTo(0, 0);
      document
        .querySelector<HTMLElement>("main")
        ?.focus({ preventScroll: true });
    }
  }, [loc.pathname, loc.hash]);
  return null;
}
const query = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={query}>
      <LanguageProvider>
        <BrowserRouter>
          <RouteEffects />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            {(["verify", "reset", "forgot", "invite", "resend"] as const).map(
              (m) => (
                <Route
                  key={m}
                  path={"/" + m}
                  element={<TokenPage mode={m} />}
                />
              ),
            )}
            <Route path="/app/*" element={<PrivateApp />} />
            {["Privacy", "Terms", "Contact"].map((m) => (
              <Route
                key={m}
                path={"/" + m.toLowerCase()}
                element={<Policy kind={m} />}
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
