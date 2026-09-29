import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Camera,
  ShieldCheck,
  UserRound,
  SlidersHorizontal,
} from "lucide-react";
import { api, upload } from "./api";
import { useLanguage } from "./language";
export function ProfilePage({ user }: { user: Record<string, any> }) {
  const { t } = useLanguage(),
    qc = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null);
  return (
    <div className="profile-layout">
      <section className="panel profile-card">
        <div className="profile-cover" />
        <div className="profile-photo">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={t("Your profile photo", "আপনার প্রোফাইল ছবি")}
            />
          ) : (
            <UserRound size={52} />
          )}
        </div>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <span className="profile-verified">
          <ShieldCheck size={16} />
          {t("Verified email", "যাচাইকৃত ইমেইল")}
        </span>
        <p>
          {t(
            "Your address, phone and photo are visible only in your own account.",
            "আপনার ঠিকানা, ফোন ও ছবি শুধু নিজের অ্যাকাউন্টে দেখা যাবে।",
          )}
        </p>
        <label className="photo-picker">
          <Camera size={18} />
          {t("Change photo", "ছবি পরিবর্তন")}
          <input
            aria-label={t("Profile photo", "প্রোফাইল ছবি")}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError("");
              setMessage("");
              if (file.size > 2 * 1024 * 1024) {
                setError(
                  t(
                    "Photo must be 2 MB or smaller.",
                    "ছবি সর্বোচ্চ ২ এমবি হতে পারবে।",
                  ),
                );
                e.target.value = "";
                return;
              }
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setError(
                  t("Choose JPG, PNG or WebP.", "JPG, PNG বা WebP বেছে নিন।"),
                );
                e.target.value = "";
                return;
              }
              setBusy(true);
              try {
                await upload("__profile", file, setProgress);
                await qc.invalidateQueries({ queryKey: ["me"] });
                setMessage(
                  t("Profile photo saved.", "প্রোফাইল ছবি সংরক্ষিত হয়েছে।"),
                );
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
                setProgress(null);
              }
            }}
          />
        </label>
        <small>JPG / PNG / WebP · {t("Up to 2 MB", "সর্বোচ্চ ২ এমবি")}</small>
        {progress !== null && (
          <progress
            max="100"
            value={progress}
            aria-label={t("Photo upload progress", "ছবি আপলোডের অগ্রগতি")}
          />
        )}
      </section>
      <section className="panel profile-details">
        <span className="eyebrow">{t("YOUR SPACE", "আপনার পরিচয়")}</span>
        <h2>{t("Personal information", "ব্যক্তিগত তথ্য")}</h2>
        <p>
          {t(
            "Keep contact details up to date. Optional fields may be left empty.",
            "যোগাযোগের তথ্য হালনাগাদ রাখুন। ঐচ্ছিক ঘরগুলো খালি রাখতে পারেন।",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await api(
                "/me",
                { ...data, smsConsent: !!user.smsConsent },
                "PATCH",
              );
              await qc.invalidateQueries({ queryKey: ["me"] });
              setMessage(
                t(
                  "Personal information saved.",
                  "ব্যক্তিগত তথ্য সংরক্ষিত হয়েছে।",
                ),
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="profile-fields">
            <label>
              {t("Full name", "পূর্ণ নাম")}
              <input
                name="name"
                defaultValue={user.name}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label>
              {t("Phone (optional)", "ফোন (ঐচ্ছিক)")}
              <input
                name="phone"
                type="tel"
                defaultValue={user.phone}
                placeholder="+8801XXXXXXXXX"
                pattern="(\+8801[0-9]{9})?"
                autoComplete="tel"
              />
            </label>
            <label>
              {t(
                "Occupation / institution (optional)",
                "পেশা / প্রতিষ্ঠান (ঐচ্ছিক)",
              )}
              <input
                name="occupation"
                defaultValue={user.occupation}
                maxLength={80}
              />
            </label>
            <label>
              {t("Email", "ইমেইল")}
              <input value={user.email} type="email" readOnly />
            </label>
          </div>
          <label>
            {t("Address (optional)", "ঠিকানা (ঐচ্ছিক)")}
            <textarea
              name="address"
              aria-label={t("Address (optional)", "ঠিকানা (ঐচ্ছিক)")}
              defaultValue={user.address}
              maxLength={300}
              rows={2}
              autoComplete="street-address"
            />
          </label>
          <label>
            {t("About me (optional)", "নিজের সম্পর্কে (ঐচ্ছিক)")}
            <textarea
              name="bio"
              aria-label={t("About me (optional)", "নিজের সম্পর্কে (ঐচ্ছিক)")}
              defaultValue={user.bio}
              maxLength={500}
              rows={3}
            />
          </label>
          <button className="button dark" disabled={busy}>
            {busy
              ? t("Saving…", "সংরক্ষণ হচ্ছে…")
              : t("Save profile", "প্রোফাইল সংরক্ষণ")}
          </button>
        </form>
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
      </section>
    </div>
  );
}
export function PersonalSettings({ user }: { user: Record<string, any> }) {
  const { t, bn, toggle } = useLanguage();
  const [density, setDensity] = useState(
      localStorage.getItem("density") || "comfortable",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel personal-settings">
      <div className="panel-heading">
        <h2>{t("Your preferences & security", "আপনার পছন্দ ও নিরাপত্তা")}</h2>
        <SlidersHorizontal />
      </div>
      <div className="profile-fields">
        <label>
          {t("Interface language", "অ্যাপের ভাষা")}
          <select
            aria-label={t("Interface language", "অ্যাপের ভাষা")}
            value={bn ? "bn" : "en"}
            onChange={(e) => {
              if ((e.target.value === "bn") !== bn) toggle();
            }}
          >
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t(
            "Table spacing (this browser)",
            "টেবিলের ফাঁকা জায়গা (এই ব্রাউজার)",
          )}
          <select
            aria-label={t(
              "Table spacing (this browser)",
              "টেবিলের ফাঁকা জায়গা (এই ব্রাউজার)",
            )}
            value={density}
            onChange={(e) => {
              const v = e.target.value;
              setDensity(v);
              localStorage.setItem("density", v);
              document.documentElement.dataset.density = v;
            }}
          >
            <option value="comfortable">{t("Comfortable", "স্বাভাবিক")}</option>
            <option value="compact">{t("Compact", "কম ফাঁকা")}</option>
          </select>
        </label>
      </div>
      <div className="settings-info">
        <ShieldCheck />
        <div>
          <strong>{user.email}</strong>
          <p>
            {t(
              "Email and in-app updates are enabled. SMS is not enabled. Password reset goes to your verified email.",
              "ইমেইল ও অ্যাপের বিজ্ঞপ্তি চালু আছে। SMS চালু নেই। পাসওয়ার্ড রিসেটের লিংক আপনার যাচাইকৃত ইমেইলে যাবে।",
            )}
          </p>
        </div>
      </div>
      <div className="row-actions">
        <Link className="button outline" to="/app/profile">
          {t("Edit personal profile", "ব্যক্তিগত প্রোফাইল বদলান")}
        </Link>
        <Link className="button outline" to="/forgot">
          {t("Reset password", "পাসওয়ার্ড রিসেট")}
        </Link>
        <button
          className="button outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await api("/me/revoke-other-sessions", {});
              setMessage(
                t(
                  "Other sessions signed out. This session stays active.",
                  "অন্য ডিভাইসের session বন্ধ হয়েছে। এই session চালু আছে।",
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("Sign out other devices", "অন্য ডিভাইস থেকে লগআউট")}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
