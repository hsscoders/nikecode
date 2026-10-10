"use client";

import { useEffect, useState } from "react";
import { Save, LogIn, UserPlus, Home, SlidersHorizontal } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api } from "../../../lib/api";
import {
  Field,
  TextInput,
  TextArea,
  Loader,
  Toast,
  useToast,
} from "../../../components/ui";

const TABS = [
  { key: "login", label: "Login Page", Icon: LogIn },
  { key: "register", label: "Register Page", Icon: UserPlus },
  { key: "home", label: "Home Page", Icon: Home },
  { key: "limits", label: "Limits & General", Icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("login");
  const [site, setSite] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        setSite({
          loginTitle: "",
          loginSubtitle: "",
          registerTitle: "",
          registerSubtitle: "",
          homeSubtitle: "",
          announcement: "",
          telegramUrl: "",
          downloadUrl: "",
          supportUrl: "",
          minRecharge: 530,
          minWithdraw: 130,
          ...(d.settings && d.settings.site ? d.settings.site : {}),
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setSite((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ site }),
      });
      showToast("Site settings saved — applied on the client instantly");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Site Settings" sub="Control client app page texts, links and limits here">
      <Toast message={toast} isError={isError} />

      {!site ? (
        <Loader />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-extrabold transition-all duration-150 ${
                  tab === key
                    ? "bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white shadow-[0_6px_16px_rgba(124,29,51,0.3)]"
                    : "border border-line-rose bg-white text-[#7d6a6e] hover:bg-[#fbf1f3]"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Panels */}
          <div className="admin-card p-6">
            {tab === "login" && (
              <div className="flex flex-col gap-4">
                <div className="font-display text-[16px] font-bold text-ink">Login Page Setting</div>
                <Field label="Login Tab Title" hint="Main tab label on the client login page">
                  <TextInput value={site.loginTitle} onChange={(e) => set("loginTitle", e.target.value)} placeholder="Login" />
                </Field>
                <Field label="Login Page Subtitle" hint="Leave blank to use the client default">
                  <TextArea
                    value={site.loginSubtitle}
                    onChange={(e) => set("loginSubtitle", e.target.value)}
                    placeholder="Login to your account to continue earning"
                  />
                </Field>
              </div>
            )}

            {tab === "register" && (
              <div className="flex flex-col gap-4">
                <div className="font-display text-[16px] font-bold text-ink">Register Page Setting</div>
                <Field label="Register Tab Title">
                  <TextInput value={site.registerTitle} onChange={(e) => set("registerTitle", e.target.value)} placeholder="Register" />
                </Field>
                <Field label="Register Page Subtitle">
                  <TextArea
                    value={site.registerSubtitle}
                    onChange={(e) => set("registerSubtitle", e.target.value)}
                    placeholder="Create account and start earning daily"
                  />
                </Field>
              </div>
            )}

            {tab === "home" && (
              <div className="flex flex-col gap-4">
                <div className="font-display text-[16px] font-bold text-ink">Home Page Setting</div>
                <Field label="Header Tagline" hint="Line shown below the header logo">
                  <TextInput value={site.homeSubtitle} onChange={(e) => set("homeSubtitle", e.target.value)} placeholder="Earn daily, withdraw daily" />
                </Field>
                <Field label="Announcement / Notice" hint="Shown in the home page notice popup">
                  <TextArea value={site.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="Welcome offer — recharge today and get daily income!" />
                </Field>
                <Field label="Telegram Channel URL">
                  <TextInput value={site.telegramUrl} onChange={(e) => set("telegramUrl", e.target.value)} placeholder="https://t.me/yourchannel" />
                </Field>
                <Field label="Download App URL" hint="APK direct link — used in the profile Download App menu">
                  <TextInput value={site.downloadUrl} onChange={(e) => set("downloadUrl", e.target.value)} placeholder="https://example.com/app.apk" />
                </Field>
                <Field label="Support / WhatsApp URL">
                  <TextInput value={site.supportUrl} onChange={(e) => set("supportUrl", e.target.value)} placeholder="https://wa.me/91xxxxxxxxxx" />
                </Field>
              </div>
            )}

            {tab === "limits" && (
              <div className="flex flex-col gap-4">
                <div className="font-display text-[16px] font-bold text-ink">Limits & General</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Minimum Recharge (₹)" hint="Used in client recharge validation">
                    <TextInput type="number" min="0" value={site.minRecharge} onChange={(e) => set("minRecharge", e.target.value)} />
                  </Field>
                  <Field label="Minimum Withdrawal (₹)" hint="The withdraw API validates against this">
                    <TextInput type="number" min="0" value={site.minWithdraw} onChange={(e) => set("minWithdraw", e.target.value)} />
                  </Field>
                </div>
                <div className="rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
                  These limits are also enforced server-side in the invest / withdraw APIs — the client
                  only receives them for display, so they stay manipulation-safe.
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button type="button" className="admin-btn admin-btn-primary px-8" onClick={save} disabled={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Save All Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
