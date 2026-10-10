"use client";

import { useEffect, useState } from "react";
import { Search, RefreshCw, TrendingUp, Crown, Gem } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtD } from "../../../lib/api";
import { Pill, Loader, Toast, useToast } from "../../../components/ui";

export default function InvestsPage() {
  const [invests, setInvests] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { toast, showToast, isError } = useToast();

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/invests" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setInvests(d.invests);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = (invests || []).reduce((s, i) => s + (i.price || 0), 0);

  return (
    <AdminShell title="Invest Records" sub="User purchases — complete record of all plans bought">
      <Toast message={toast} isError={isError} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line-rose bg-white px-3.5 py-2.5 sm:max-w-[360px]">
          <Search size={16} className="shrink-0 text-icon-rose" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium text-ink outline-none placeholder:text-[#c4a9b0]"
            placeholder="Search phone / userid / plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(search);
                load(search);
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              setQuery(search);
              load(search);
            }}
            className="cursor-pointer rounded-lg bg-[#f7e3e7] px-3 py-1.5 text-[12px] font-extrabold text-maroon-700 transition-colors hover:bg-[#f3d5dc]"
          >
            Search
          </button>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => {
            setSearch("");
            setQuery("");
            load("");
          }}
        >
          <RefreshCw size={15} />
          Reset
        </button>
        <div className="ml-auto flex items-center gap-4 text-[13px] font-bold text-ink">
          <span className="flex items-center gap-1.5">
            <TrendingUp size={15} className="text-maroon-600" />
            {invests ? invests.length + " record(s)" : "—"}
          </span>
          <span className="rounded-full bg-[#f7e3e7] px-3 py-1 text-maroon-700">{fmt0(total)}</span>
        </div>
      </div>

      {!invests ? (
        <Loader />
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>User ID</th>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Daily</th>
                  <th>Cycle</th>
                  <th>Total Return</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invests.map((inv) => (
                  <tr key={inv._id}>
                    <td className="whitespace-nowrap font-medium text-[#7d6a6e]">{fmtD(inv.createdAt)}</td>
                    <td className="whitespace-nowrap font-bold text-ink">+91 {inv.phone}</td>
                    <td className="font-semibold text-[#7d6a6e]">{inv.userid || "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-[30px] w-[30px] place-items-center rounded-[9px] ${
                            inv.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[#f7e3e7] text-maroon-600"
                          }`}
                        >
                          {inv.vip ? <Crown size={15} /> : <Gem size={15} />}
                        </span>
                        <span className="font-bold text-ink">{inv.planName}</span>
                      </div>
                    </td>
                    <td className="font-bold text-maroon-700">{fmt0(inv.price)}</td>
                    <td className="font-bold text-[#16a34a]">{fmt0(inv.daily)}</td>
                    <td className="font-semibold text-ink">{inv.cycle} Days</td>
                    <td className="font-bold text-[#a9791c]">{fmt0(inv.total)}</td>
                    <td>
                      <Pill value={inv.status} />
                    </td>
                  </tr>
                ))}
                {invests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[13.5px] font-medium text-muted-rose">
                      No invest records yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
