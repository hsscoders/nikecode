"use client";

import { useEffect, useState } from "react";
import { Save, ArrowUpFromLine, Percent, Clock } from "lucide-react";
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
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const w = d.settings && d.settings.withdraw ? d.settings.withdraw : {};
        setCfg({
          minAmount: 130,
          maxAmount: 50000,
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

  const save = async () => {
    const minA = Number(cfg.minAmount) || 0;
    const maxA = Number(cfg.maxAmount) || 0;
    if (minA <= 0) return showToast("Enter a valid minimum amount", true);
    if (maxA > 0 && maxA < minA)
      return showToast("Maximum amount must be greater than minimum", true);
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          withdraw: {
            minAmount: minA,
            maxAmount: maxA,
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
