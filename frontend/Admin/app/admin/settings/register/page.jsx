"use client";

import { useEffect, useState } from "react";
import { Gift, Power, Save } from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import {
  Field,
  TextInput,
  Loader,
  Toast,
  useToast,
} from "../../../../components/ui";

export default function RegisterBonusPage() {
  const [rb, setRb] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        if (d.settings && d.settings.registerBonus)
          setRb({
            enabled: d.settings.registerBonus.enabled === true,
            amount: d.settings.registerBonus.amount || 0,
          });
        else setRb({ enabled: false, amount: 0 });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* bonus switch — instant save (one click, no Save button needed) */
  const toggleBonus = async () => {
    const next = !rb.enabled;
    const prev = rb;
    setRb((c) => ({ ...c, enabled: next }));
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ registerBonus: { enabled: next } }),
      });
      showToast(
        next
          ? "Register bonus ACTIVE — new users will get the bonus"
          : "Register bonus OFF — new users get no bonus"
      );
    } catch (e) {
      setRb(prev);
      showToast(e.message, true);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ registerBonus: rb }),
      });
      showToast("Register bonus saved — applied on the next signup instantly");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Register Bonus" sub="Signup bonus — switch and amount for every new user">
      <Toast message={toast} isError={isError} />

      {!rb ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          {/* ===== REGISTER BONUS — switch + amount ===== */}
          <div className="admin-card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d4a94f]/12 text-[#b8860b]">
                <Gift size={17} strokeWidth={2.4} />
              </span>
              <div className="font-display text-[16px] font-bold text-ink">
                Register Bonus
              </div>
            </div>

            {/* master switch — instant save */}
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3.5 ${
                rb.enabled
                  ? "border-[#bfe3cd] bg-[#f0faf3]"
                  : "border-[#f3c4c4] bg-[#fdf1f1]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${
                    rb.enabled
                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                      : "bg-[#dc2626]/10 text-[#dc2626]"
                  }`}
                >
                  <Power size={17} strokeWidth={2.4} />
                </span>
                <div>
                  <div className="text-[14px] font-bold text-ink">Bonus Switch</div>
                  <div
                    className={`text-[12px] font-semibold ${
                      rb.enabled ? "text-[#16a34a]" : "text-[#dc2626]"
                    }`}
                  >
                    {rb.enabled
                      ? `Active — every new user gets ₹${rb.amount || 0} on signup`
                      : "Inactive — new users get no bonus"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleBonus}
                className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  rb.enabled ? "bg-[#16a34a]" : "bg-[#c9b8bd]"
                }`}
                aria-label="Toggle register bonus"
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${
                    rb.enabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* amount */}
            <Field
              label="Bonus Amount (₹)"
              hint="Credited to the user's Recharge Balance right after signup — 0 = no bonus"
            >
              <TextInput
                type="number"
                min="0"
                value={rb.amount}
                onChange={(e) =>
                  setRb((c) => ({ ...c, amount: Number(e.target.value) || 0 }))
                }
                placeholder="51"
              />
            </Field>
            <div className="flex items-center gap-2 rounded-xl border border-line-rose bg-[#fdf6e4]/60 px-4 py-3 text-[12.5px] font-semibold text-[#8a6a1c]">
              <Gift size={15} className="shrink-0" />
              The bonus is credited server-side inside the register API (manipulation-safe) —
              the user receives it in their Recharge Balance and a &quot;Register bonus&quot;
              entry appears in their Transaction History. After changing the amount,
              press Save below.
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
              {saving ? "Saving..." : "Save Register Bonus"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
