"use client";

import { useEffect, useState } from "react";
import { Percent, Users, Network, Share2, Save } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0 } from "../../../lib/api";
import { Loader, Toast, useToast } from "../../../components/ui";

const LEVELS = [
  {
    key: "level1",
    label: "Level 1 Commission",
    desc: "Direct referral — earned on every plan purchase by users registered with your invite code",
    Icon: Users,
    tile: "bg-[#f7e3e7] text-maroon-600",
    example: 250,
  },
  {
    key: "level2",
    label: "Level 2 Commission",
    desc: "Earned on plan purchases by referrals of your Level-1 members",
    Icon: Network,
    tile: "bg-[#fdf6e4] text-[#a9791c]",
    example: 30,
  },
  {
    key: "level3",
    label: "Level 3 Commission",
    desc: "Earned on plan purchases by referrals of your Level-2 members",
    Icon: Share2,
    tile: "bg-[#eef4ff] text-[#2563eb]",
    example: 20,
  },
];

export default function CommissionPage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/commission");
        setForm(d.commission);
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    for (const l of ["level1", "level2", "level3"]) {
      const v = Number(form[l]);
      if (isNaN(v) || v < 0 || v > 100)
        return showToast("Commission must be between 0 and 100", true);
    }
    setSaving(true);
    try {
      await api("/api/admin/commission", {
        method: "PUT",
        body: JSON.stringify({
          level1: Number(form.level1),
          level2: Number(form.level2),
          level3: Number(form.level3),
        }),
      });
      showToast("Commission settings saved");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Invite Commission"
      sub="Auto-credited on team purchases — goes to the user's withdrawal balance"
    >
      <Toast message={toast} isError={isError} />

      {!form ? (
        <Loader />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {LEVELS.map(({ key, label, desc, Icon, tile, example }) => (
              <div key={key} className="admin-card p-5">
                <div className="flex items-center gap-3">
                  <div className={`grid h-[46px] w-[46px] place-items-center rounded-[14px] ${tile}`}>
                    <Icon size={22} strokeWidth={2.1} />
                  </div>
                  <div className="font-display text-[16px] font-bold text-ink">{label}</div>
                </div>
                <p className="mt-3 min-h-[38px] text-[12.5px] font-medium leading-relaxed text-muted-rose">
                  {desc}
                </p>
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line-rose bg-[#fdfafa] px-4 py-3 focus-within:border-maroon-500 focus-within:ring-[3px] focus-within:ring-maroon-600/10">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 font-display text-[26px] font-bold text-maroon-700 outline-none"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                  <Percent size={22} className="shrink-0 text-icon-rose" />
                </div>
                <div className="mt-2.5 text-[11.5px] font-semibold text-[#8a6e75]">
                  On ₹1,000 invest → <span className="font-extrabold text-[#16a34a]">{fmt0(example)}</span>{" "}
                  commission
                </div>
              </div>
            ))}
          </div>

          {/* Example flow */}
          <div className="admin-card p-5">
            <div className="font-display text-[16px] font-bold text-ink">How it works</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                "User shares their own invite code in the app",
                "New user registers with that code — an L1 → L2 → L3 chain is formed",
                "On every plan purchase, the commission % is auto-credited to the user's balance",
              ].map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-line-rose bg-[#fbf1f3] px-3.5 py-3 text-[12.5px] font-medium text-ink"
                >
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-maroon-700 text-[11px] font-extrabold text-white">
                    {i + 1}
                  </span>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button type="button" className="admin-btn admin-btn-primary px-8" onClick={save} disabled={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Save Commission Settings"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
