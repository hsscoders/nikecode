"use client";

import { useEffect, useState } from "react";
import {
  Save,
  Type,
  Megaphone,
  Link2,
  LogIn,
  Info,
  ExternalLink,
} from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

/* ============ WEBSITE TEXTS & LINKS ============
   Everything here is live on the client site:
   - Login / Register headings (login + register pages read the site context)
   - Home tagline → golden line under the brand name in the header
   - Announcement → scrolling marquee bar under the home header (empty = hidden)
   - Telegram URL → home "Channel" quick-action button opens it in a new tab
   - Support / Download URLs are reserved links for header/profile buttons */

const EMPTY = {
  loginTitle: "",
  loginSubtitle: "",
  registerTitle: "",
  registerSubtitle: "",
  homeSubtitle: "",
  announcement: "",
  telegramUrl: "",
  supportUrl: "",
  downloadUrl: "",
};

export default function WebsiteTextsPage() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const s = (d.settings && d.settings.site) || {};
        setCfg({ ...EMPTY, ...s });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          site: {
            loginTitle: cfg.loginTitle,
            loginSubtitle: cfg.loginSubtitle,
            registerTitle: cfg.registerTitle,
            registerSubtitle: cfg.registerSubtitle,
            homeSubtitle: cfg.homeSubtitle,
            announcement: cfg.announcement,
            telegramUrl: cfg.telegramUrl,
            supportUrl: cfg.supportUrl,
            downloadUrl: cfg.downloadUrl,
          },
        }),
      });
      showToast("Website texts saved — live on the client site");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Website Texts & Links"
      sub="Client site texts and links — live update, no refresh needed"
    >
      <Toast message={toast} isError={isError} />

      {!cfg ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[860px] flex-col gap-3.5 sm:gap-5">
          {/* ===== INFO STRIP ===== */}
          <div className="admin-card flex items-start gap-3 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f7e3e7] text-maroon-600">
              <Info size={17} />
            </div>
            <p className="text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              Control every client-site text and link from here. Saving updates
              all open pages instantly — no refresh needed. Leave a field blank
              to keep the built-in default text.
            </p>
          </div>

          {/* ===== LOGIN / REGISTER TEXTS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex items-center gap-2">
              <LogIn size={17} className="text-maroon-700" />
              <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                Login & Register Headings
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Login Title" hint="Big heading on the login page">
                <TextInput
                  value={cfg.loginTitle}
                  onChange={(e) => set("loginTitle", e.target.value)}
                  placeholder="Login"
                  maxLength={40}
                />
              </Field>
              <Field label="Login Subtitle" hint="Small line under the title">
                <TextInput
                  value={cfg.loginSubtitle}
                  onChange={(e) => set("loginSubtitle", e.target.value)}
                  placeholder="Welcome back, please sign in"
                  maxLength={120}
                />
              </Field>
              <Field label="Register Title">
                <TextInput
                  value={cfg.registerTitle}
                  onChange={(e) => set("registerTitle", e.target.value)}
                  placeholder="Register"
                  maxLength={40}
                />
              </Field>
              <Field label="Register Subtitle">
                <TextInput
                  value={cfg.registerSubtitle}
                  onChange={(e) => set("registerSubtitle", e.target.value)}
                  placeholder="Create your account in 1 minute"
                  maxLength={120}
                />
              </Field>
            </div>
          </div>

          {/* ===== HOME TEXTS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Type size={17} className="text-maroon-700" />
              <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                Home Page Texts
              </div>
            </div>

            <Field
              label="Home Tagline"
              hint="Golden line under the brand name in the header (default: Earn daily, withdraw daily)"
            >
              <TextInput
                value={cfg.homeSubtitle}
                onChange={(e) => set("homeSubtitle", e.target.value)}
                placeholder="Earn daily, withdraw daily"
                maxLength={80}
              />
            </Field>

            <Field
              label="Announcement Bar"
              hint="Scrolling marquee under the home header — leave blank to hide"
            >
              <TextInput
                value={cfg.announcement}
                onChange={(e) => set("announcement", e.target.value)}
                placeholder="Recharge now and earn daily!"
                maxLength={160}
              />
            </Field>
            {cfg.announcement.trim() && (
              <div className="flex items-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(90deg,#571224,#6b1830)] px-4 py-2.5">
                <Megaphone size={13} className="shrink-0 text-gold" />
                <span className="whitespace-nowrap text-[11.5px] font-semibold text-gold">
                  {cfg.announcement}
                </span>
              </div>
            )}
          </div>

          {/* ===== LINKS ===== */}
          <div className="admin-card flex flex-col gap-3 p-3.5 sm:gap-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-maroon-700" />
              <div className="font-display text-[15px] font-bold text-ink sm:text-[16px]">
                Action Links
              </div>
            </div>

            <Field
              label="Telegram Channel URL"
              hint="The home Channel button opens this link in a new tab (blank = coming-soon toast)"
            >
              <TextInput
                value={cfg.telegramUrl}
                onChange={(e) => set("telegramUrl", e.target.value)}
                placeholder="https://t.me/yourchannel"
                maxLength={500}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Support URL" hint="Customer support link">
                <TextInput
                  value={cfg.supportUrl}
                  onChange={(e) => set("supportUrl", e.target.value)}
                  placeholder="https://t.me/support"
                  maxLength={500}
                />
              </Field>
              <Field label="App Download URL" hint="APK / app download link">
                <TextInput
                  value={cfg.downloadUrl}
                  onChange={(e) => set("downloadUrl", e.target.value)}
                  placeholder="https://example.com/app.apk"
                  maxLength={500}
                />
              </Field>
            </div>

            {(cfg.telegramUrl || cfg.supportUrl || cfg.downloadUrl) && (
              <div className="flex flex-wrap gap-2">
                {[
                  { u: cfg.telegramUrl, l: "Telegram" },
                  { u: cfg.supportUrl, l: "Support" },
                  { u: cfg.downloadUrl, l: "Download" },
                ]
                  .filter((x) => x.u.trim())
                  .map(({ u, l }) => (
                    <a
                      key={l}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#fbf1f3] px-3 py-1.5 text-[11.5px] font-bold text-maroon-700 transition-colors hover:bg-[#f7e3e7]"
                    >
                      <ExternalLink size={12} />
                      Test {l}
                    </a>
                  ))}
              </div>
            )}
          </div>

          {/* ===== SAVE ===== */}
          <div className="sticky bottom-3 flex justify-end sm:bottom-4">
            <button
              type="button"
              className="admin-btn admin-btn-primary w-full px-6 shadow-[0_10px_26px_rgba(124,29,51,0.35)] sm:w-auto sm:px-8"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Website Texts"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
