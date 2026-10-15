"use client";

import { useEffect, useState } from "react";
import { Search, RefreshCw, TrendingUp, Crown, Gem } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtD } from "../../../lib/api";
import { Pill, Loader, Toast, useToast, Pagination } from "../../../components/ui";

export default function InvestsPage() {
  const [invests, setInvests] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const PER = 20;
  const { toast, showToast, isError } = useToast();

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/invests" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setInvests(d.invests);
      setPage(0); /* fresh dataset — back to the first page */
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = (invests || []).reduce((s, i) => s + (i.price || 0), 0);
  const pages = Math.max(1, Math.ceil((invests || []).length / PER));
  const safePage = Math.min(page, pages - 1);
  const rows = (invests || []).slice(safePage * PER, safePage * PER + PER);

  return (
    <AdminShell title="Invest Records" sub="User purchases — complete record of all plans bought">
      <Toast message={toast} isError={isError} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 sm:max-w-[360px]">
          <Search size={16} className="shrink-0 text-icon" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-none placeholder:text-muted sm:text-[13.5px]"
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
            className="hidden cursor-pointer rounded-lg bg-[var(--color-tint2)] px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-[var(--color-line)] sm:block"
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
            <TrendingUp size={15} className="text-brand-600" />
            {invests ? invests.length + " record(s)" : "—"}
          </span>
          <span className="rounded-full bg-[var(--color-tint2)] px-3 py-1 text-brand-700">{fmt0(total)}</span>
        </div>
      </div>

      {!invests ? (
        <Loader />
      ) : (
        <>
        {/* MOBILE — compact card list (table hidden below sm) */}
        <div className="flex flex-col gap-2.5 sm:hidden">
          {rows.map((inv) => (
            <div key={inv._id} className="admin-card p-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] ${
                    inv.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-600"
                  }`}
                >
                  {inv.vip ? <Crown size={18} /> : <Gem size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-extrabold leading-tight text-ink">{inv.planName}</div>
                  <div className="mt-0.5 text-[10.5px] font-semibold text-muted">{fmtD(inv.createdAt)}</div>
                </div>
                <Pill value={inv.status} />
              </div>

              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-muted">Price</div>
                  <div className="mt-0.5 font-display text-[18px] font-extrabold leading-none text-brand-700">
                    {fmt0(inv.price)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-muted">Total Return</div>
                  <div className="mt-0.5 text-[13px] font-extrabold leading-none text-[#a9791c]">{fmt0(inv.total)}</div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--color-tint)] p-2">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">Daily</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-[#16a34a]">{fmt0(inv.daily)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">Cycle</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-ink">{inv.cycle}d</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">User</div>
                  <div className="mt-0.5 truncate text-[12.5px] font-extrabold text-ink">{inv.userid || "—"}</div>
                </div>
              </div>

              <div className="mt-2 border-t border-line/60 pt-2 text-[11.5px] font-bold text-[#475569]">
                +91 {inv.phone}
              </div>
            </div>
          ))}
          {invests.length === 0 && (
            <div className="admin-card py-8 text-center text-[13px] font-medium text-muted">
              No invest records yet
            </div>
          )}
        </div>

        {/* DESKTOP — full table */}
        <div className="admin-card hidden overflow-hidden sm:block">
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
                {rows.map((inv) => (
                  <tr key={inv._id}>
                    <td className="whitespace-nowrap font-medium text-[#475569]">{fmtD(inv.createdAt)}</td>
                    <td className="whitespace-nowrap font-bold text-ink">+91 {inv.phone}</td>
                    <td className="font-semibold text-[#475569]">{inv.userid || "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-[30px] w-[30px] place-items-center rounded-[9px] ${
                            inv.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-600"
                          }`}
                        >
                          {inv.vip ? <Crown size={15} /> : <Gem size={15} />}
                        </span>
                        <span className="font-bold text-ink">{inv.planName}</span>
                      </div>
                    </td>
                    <td className="font-bold text-brand-700">{fmt0(inv.price)}</td>
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
                    <td colSpan={9} className="py-10 text-center text-[13.5px] font-medium text-muted">
                      No invest records yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        <Pagination page={safePage} pages={pages} onPage={setPage} total={invests.length} />
        </>
      )}
    </AdminShell>
  );
}
