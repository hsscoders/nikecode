"use client";

import { useEffect, useState } from "react";
import { Save, ArrowUpFromLine, Percent, Clock, BadgePercent, Timer, Power } from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  TextArea,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

export default function WithdrawSettingsPage() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const w = d.settings && d.settings.withdraw ? d.settings.withdraw : {};
        setCfg({
          minAmount: 130,
          maxAmount: 50000,
          chargePercent: 10,
          dailyLimit: 0,
          startTime: "00:00",
          endTime: "23:59",
          enabled: true,
          note: "Withdrawals are processed within 24 hours",
          ...w,
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  /* live charge preview — ₹500 example inside the charge card */
  const chgPct = Math.min(100, Math.max(0, Number(cfg && cfg.chargePercent) || 0));

  /* one-click master switch — saves instantly, no need to press Save */
  const toggleSwitch = async () => {
    if (!cfg) return;
    const next = cfg.enabled === false;
    setCfg((c) => ({ ...c, enabled: next }));
    setSwitching(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ withdraw: { enabled: next } }),
      });
      showToast(
        next
          ? "Withdrawals resumed — users can withdraw again"
          : "All withdrawals stopped — the client page now shows a stopped banner"
      );
    } catch (e) {
      setCfg((c) => ({ ...c, enabled: !next }));
      showToast(e.message, true);
    } finally {
      setSwitching(false);
    }
  };

  const save = async () => {
    const minA = Number(cfg.minAmount) || 0;
    const maxA = Number(cfg.maxAmount) || 0;
    const chg = Number(cfg.chargePercent) || 0;
    const dl = Number(cfg.dailyLimit) || 0;
    if (minA <= 0) return showToast("Enter a valid minimum amount", true);
    if (maxA > 0 && maxA < minA)
      return showToast("Maximum amount must be greater than minimum", true);
    if (chg < 0 || chg > 100)
      return showToast("Charge must be between 0 and 100 percent", true);
    if (dl < 0 || dl > 99)
      return showToast("Daily limit must be between 0 and 99", true);
    if (!/^\d{2}:\d{2}$/.test(String(cfg.startTime)) || !/^\d{2}:\d{2}$/.test(String(cfg.endTime)))
      return showToast("Set both the start and end times", true);
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          withdraw: {
            minAmount: minA,
            maxAmount: maxA,
            chargePercent: chg,
            dailyLimit: dl,
            startTime: cfg.startTime,
            endTime: cfg.endTime,
            enabled: cfg.enabled !== false,
            note: cfg.note,
          },
        }),
      });
      showToast("Withdrawal settings saved — live on the client /withdrawal page");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Withdrawal Setting"
      sub="Full control of the client /withdrawal page — limits and processing note"
    >
      <Toast message={toast} isError={isError} />

      {!cfg ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[860px] flex-col gap-5">
          {/* ===== LIMITS ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <Percent size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Withdrawal Limits
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Minimum Amount (₹)" hint="Client + withdraw API both validate this">
                <TextInput
                  type="number"
                  min="0"
                  value={cfg.minAmount}
                  onChange={(e) => set("minAmount", e.target.value)}
                />
              </Field>
              <Field label="Maximum Amount (₹)" hint="0 = no maximum limit">
                <TextInput
                  type="number"
                  min="0"
                  value={cfg.maxAmount}
                  onChange={(e) => set("maxAmount", e.target.value)}
                />
              </Field>
            </div>
            <div className="rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              These limits are enforced server-side in the withdraw API — the client only
              receives them for display, so they stay manipulation-safe.
            </div>
          </div>

          {/* ===== CHARGE ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <BadgePercent size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Withdrawal Charge
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Charge (%)" hint="0–100 — deducted from the withdrawal amount">
                <TextInput
                  type="number"
                  min="0"
                  max="100"
                  value={cfg.chargePercent}
                  onChange={(e) => set("chargePercent", e.target.value)}
                />
              </Field>
              <div className="flex flex-col justify-center rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#a98f95]">
                  Live preview — user withdraws ₹500
                </div>
                <div className="mt-2 flex flex-col gap-1 text-[13px] font-semibold">
                  <div className="flex items-center justify-between text-[#7d6a6e]">
                    <span>Charge ({chgPct}%)</span>
                    <span className="font-bold text-[#b3372f]">
                      − ₹{((500 * chgPct) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#3d2a2f]">
                    <span>You&apos;ll receive</span>
                    <span className="font-extrabold text-maroon-700">
                      ₹{(500 - (500 * chgPct) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              The charge is calculated server-side on every withdraw request and stored on
              the withdrawal record — rejecting a request refunds the user&apos;s full
              amount, the charge only applies on successful payouts.
            </div>
          </div>

          {/* ===== AVAILABILITY — switch + daily limit + time window ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <Timer size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Withdrawal Availability
              </div>
            </div>

            {/* master switch — one click stops ALL withdrawals, saves instantly */}
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${
                cfg.enabled !== false
                  ? "border-[#bfe3cd] bg-[#f0faf3]"
                  : "border-[#f3c4c4] bg-[#fdf1f1]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${
                    cfg.enabled !== false
                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                      : "bg-[#dc2626]/10 text-[#dc2626]"
                  }`}
                >
                  <Power size={17} strokeWidth={2.4} />
                </span>
                <div>
                  <div className="text-[14px] font-bold text-ink">Withdraw Switch</div>
                  <div
                    className={`text-[12px] font-semibold ${
                      cfg.enabled !== false ? "text-[#16a34a]" : "text-[#dc2626]"
                    }`}
                  >
                    {cfg.enabled !== false
                      ? "Open — users can withdraw"
                      : "Stopped — ALL withdrawals blocked"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={cfg.enabled !== false}
                aria-label="Withdraw switch"
                onClick={toggleSwitch}
                disabled={switching}
                className={`relative h-7 w-[52px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  cfg.enabled !== false ? "bg-[#16a34a]" : "bg-[#c9b8bd]"
                } ${switching ? "opacity-60" : ""}`}
              >
                <span
                  className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    cfg.enabled !== false ? "left-[29px]" : "left-[3px]"
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="Daily Withdrawal Limit"
                hint="Times per user per day — 0 = unlimited"
              >
                <TextInput
                  type="number"
                  min="0"
                  max="99"
                  value={cfg.dailyLimit}
                  onChange={(e) => set("dailyLimit", e.target.value)}
                />
              </Field>
              <Field label="Withdrawal Start Time" hint="IST — e.g. 09:00">
                <TextInput
                  type="time"
                  value={cfg.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
              </Field>
              <Field label="Withdrawal End Time" hint="IST — e.g. 18:00">
                <TextInput
                  type="time"
                  value={cfg.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              Times are IST. Overnight windows work too (e.g. 22:00 → 06:00). The switch
              is instant — enforced server-side on every request, and the client page
              shows a stopped banner with a disabled button.
            </div>
          </div>

          {/* ===== NOTE ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <Clock size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Processing Note
              </div>
            </div>
            <Field
              label="Note Text"
              hint="Small line shown under the Withdraw button on the client"
            >
              <TextArea
                value={cfg.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Withdrawals are processed within 24 hours"
                maxLength={300}
              />
            </Field>
          </div>

          {/* ===== SAVE ===== */}
          <div className="sticky bottom-4 flex justify-end">
            <button
              type="button"
              className="admin-btn admin-btn-primary px-8 shadow-[0_10px_26px_rgba(124,29,51,0.35)]"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Withdrawal Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
