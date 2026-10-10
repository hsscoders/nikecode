"use client";

import { useEffect, useState } from "react";
import { Clock3, Save, Zap, Info } from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

export default function IncomeTimePage() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const inc = (d.settings && d.settings.income) || {};
        setCfg({
          creditTime: inc.creditTime || "00:00",
          lastCreditDate: inc.lastCreditDate || "",
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const t = String(cfg.creditTime || "").trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(t))
      return showToast("Enter a valid time (HH:MM, 24-hour)", true);
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ income: { creditTime: t } }),
      });
      showToast("Income time saved — wallets will be credited at " + t + " IST daily");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Income Time"
      sub="Daily plan income auto-credit — set the wallet credit time (IST)"
    >
      <Toast message={toast} isError={isError} />

      {!cfg ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          {/* ===== TIME SETTING ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Daily Income Credit Time
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              <Info size={16} className="mt-0.5 shrink-0 text-maroon-600" />
              <span>
                Buy-plan daily income is credited automatically to every user&apos;s
                withdrawal wallet at this time (Indian Standard Time). Each active plan
                pays its daily income once per day until the cycle completes — after the
                last day the plan is marked Completed.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Credit Time (IST, 24-hour)" hint="Example — 00:00 for midnight">
                <TextInput
                  type="time"
                  value={cfg.creditTime}
                  onChange={(e) => setCfg((c) => ({ ...c, creditTime: e.target.value }))}
                />
              </Field>
              <Field label="Last Auto-Credit">
                <div className="rounded-[12px] border-[1.5px] border-line-rose bg-[#fdfafa] px-3.5 py-[10px] text-[14px] font-semibold text-ink">
                  {cfg.lastCreditDate
                    ? cfg.lastCreditDate + " (" + cfg.creditTime + " IST)"
                    : "Not credited yet"}
                </div>
              </Field>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-line-rose bg-[#fdf6e4]/60 px-4 py-3 text-[12.5px] font-semibold text-[#8a6a1c]">
              <Zap size={15} className="shrink-0" />
              Current schedule: every day at {cfg.creditTime} IST
              {cfg.lastCreditDate ? " — last run " + cfg.lastCreditDate : ""}
            </div>
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
              {saving ? "Saving..." : "Save Income Time"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
