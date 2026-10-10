"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ShoppingBag,
  CircleCheck,
  Clock3,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Crown,
  RefreshCw,
  TrendingUp,
  IndianRupee,
  Trophy,
  CalendarDays,
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { api, fmt0, fmtD } from "../../lib/api";
import { Pill, Loader, Toast, useToast } from "../../components/ui";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const { toast, showToast, isError } = useToast();

  const load = async () => {
    try {
      const d = await api("/api/admin/dashboard");
      setData(d);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = data?.stats;
  const maxChart = data ? Math.max(1, ...data.chart.map((c) => c.count)) : 1;
  const maxFlow = data ? Math.max(1, ...(data.flow || []).map((f) => Math.max(f.deposit, f.withdraw))) : 1;

  const cards = st
    ? [
        { lbl: "Total Users", val: st.totalUsers, sub: "+" + st.newUsers + " this week", Icon: Users, tile: "bg-[#f7e3e7] text-maroon-600" },
        { lbl: "Total Purchases", val: st.totalPurchases, sub: fmt0(st.investedAmount) + " invested", Icon: ShoppingBag, tile: "bg-[#fdf6e4] text-[#a9791c]" },
        { lbl: "Approved Withdrawals", val: st.withdrawals.Success.count, sub: fmt0(st.withdrawals.Success.amount), Icon: CircleCheck, tile: "bg-[#eafaf0] text-[#16a34a]" },
        { lbl: "Pending Withdrawals", val: st.withdrawals.Pending.count, sub: fmt0(st.withdrawals.Pending.amount), Icon: Clock3, tile: "bg-[#fdf3e0] text-[#a9791c]" },
        { lbl: "Rejected Withdrawals", val: st.withdrawals.Rejected.count, sub: fmt0(st.withdrawals.Rejected.amount), Icon: XCircle, tile: "bg-[#fdecec] text-[#dc2626]" },
        { lbl: "Approved Deposits", val: st.deposits.Success.count, sub: fmt0(st.deposits.Success.amount), Icon: ArrowDownToLine, tile: "bg-[#eafaf0] text-[#16a34a]" },
        { lbl: "Pending Deposits", val: st.deposits.Pending.count, sub: fmt0(st.deposits.Pending.amount), Icon: Clock3, tile: "bg-[#fdf3e0] text-[#a9791c]" },
        { lbl: "Rejected Deposits", val: st.deposits.Rejected.count, sub: fmt0(st.deposits.Rejected.amount), Icon: XCircle, tile: "bg-[#fdecec] text-[#dc2626]" },
      ]
    : [];

  return (
    <AdminShell title="Admin Dashboard" sub="Platform overview — users, purchases, deposits & withdrawals">
      <Toast message={toast} isError={isError} />

      {!data ? (
        <Loader />
      ) : (
        <div className="flex flex-col gap-5">
          {/* ===== TODAY STRIP — IST business day ===== */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { lbl: "Recharge Today", val: fmt0(st.today.recharge), Icon: ArrowDownToLine, tile: "bg-[#eafaf0] text-[#16a34a]" },
              { lbl: "Withdraw Today", val: fmt0(st.today.withdrawals), Icon: ArrowUpFromLine, tile: "bg-[#f7e3e7] text-maroon-600" },
              { lbl: "New Users Today", val: st.today.users, Icon: Users, tile: "bg-[#fdf6e4] text-[#a9791c]" },
              { lbl: "Income Paid Today", val: fmt0(st.today.income), Icon: IndianRupee, tile: "bg-[#fdf3e0] text-[#a9791c]" },
            ].map(({ lbl, val, Icon, tile }) => (
              <div key={lbl} className="admin-card flex items-center gap-3.5 p-4">
                <div className={`grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[14px] ${tile}`}>
                  <Icon size={20} strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-[0.5px] text-[#8a6e75]">
                    <CalendarDays size={11} />
                    {lbl}
                  </div>
                  <div className="mt-0.5 font-display text-[21px] font-bold leading-none text-ink">{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ===== STAT CARDS ===== */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ lbl, val, sub, Icon, tile }) => (
              <div
                key={lbl}
                className="admin-card flex items-center gap-4 p-4 transition-transform duration-150 hover:-translate-y-0.5"
              >
                <div className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] ${tile}`}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-bold uppercase tracking-[0.5px] text-[#8a6e75]">
                    {lbl}
                  </div>
                  <div className="mt-0.5 font-display text-[26px] font-bold leading-none text-ink">
                    {val}
                  </div>
                  <div className="mt-1 truncate text-[11.5px] font-semibold text-muted-rose">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ===== CHART + QUICK ===== */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* 7-day registrations */}
            <div className="admin-card p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] font-bold text-ink">
                    New Users — Last 7 Days
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted-rose">
                    Daily registrations trend
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#f7e3e7] px-3 py-1.5 text-[12px] font-extrabold text-maroon-700">
                  <TrendingUp size={14} />
                  {st.newUsers} total
                </div>
              </div>
              <div className="mt-5 flex h-[170px] items-end gap-2.5 sm:gap-4">
                {data.chart.map((c) => (
                  <div key={c.day} className="group flex flex-1 flex-col items-center gap-2">
                    <div className="text-[11px] font-extrabold text-maroon-700 opacity-0 transition-opacity group-hover:opacity-100">
                      {c.count}
                    </div>
                    <div
                      className="w-full max-w-[46px] rounded-t-[8px] bg-[linear-gradient(180deg,#93293f_0%,#7c1d33_100%)] transition-all duration-300 group-hover:bg-[linear-gradient(180deg,#d4a94f_0%,#a9791c_100%)]"
                      style={{ height: Math.max(6, (c.count / maxChart) * 120) + "px" }}
                    />
                    <div className="text-[10.5px] font-bold text-muted-rose">{c.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet snapshot */}
            <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(150deg,#42091a_0%,#6b1830_60%,#93293f_100%)] p-5 shadow-[0_8px_28px_rgba(66,9,26,0.35)]">
              <div className="pointer-events-none absolute -right-10 -top-10 h-[140px] w-[140px] rounded-full bg-gold/15 blur-2xl" />
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[1px] text-gold">
                <Wallet size={14} />
                Payout Liability
              </div>
              <div className="mt-2 font-display text-[30px] font-bold text-white">
                {fmt0(st.withdrawals.Pending.amount + st.withdrawals.Processing.amount)}
              </div>
              <div className="text-[12px] font-medium text-white/55">
                Pending + Processing withdrawals
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {[
                  { lbl: "Total Withdrawn", val: fmt0(st.withdrawals.Success.amount) },
                  { lbl: "Total Deposited", val: fmt0(st.deposits.Success.amount) },
                  { lbl: "Daily Income Liability", val: fmt0(st.liability.daily) + "/day" },
                  { lbl: "In User Wallets", val: fmt0(st.wallets.balance + st.wallets.recharge) },
                  { lbl: "Charge Earned", val: fmt0(st.chargeEarned) },
                  { lbl: "Active Plans", val: st.liability.activePlans },
                ].map(({ lbl, val }) => (
                  <div key={lbl} className="rounded-[14px] bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                    <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-white/60">
                      {lbl}
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-bold text-white">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== MONEY FLOW + TOP INVESTORS ===== */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* 7-day money flow — successful deposits vs successful withdrawals */}
            <div className="admin-card p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] font-bold text-ink">
                    Money Flow — Last 7 Days
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted-rose">
                    Successful deposits vs successful withdrawals
                  </div>
                </div>
                <div className="flex items-center gap-3.5 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-maroon-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#7c1d33]" /> Deposits
                  </span>
                  <span className="flex items-center gap-1.5 text-[#a9791c]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#d4a94f]" /> Withdrawals
                  </span>
                </div>
              </div>
              <div className="mt-5 flex h-[170px] items-end gap-2.5 sm:gap-4">
                {(data.flow || []).map((f) => (
                  <div key={f.day} className="group flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-[120px] w-full max-w-[52px] items-end justify-center gap-1">
                      <div
                        className="w-[45%] rounded-t-[6px] bg-[linear-gradient(180deg,#93293f_0%,#7c1d33_100%)] transition-all duration-300"
                        style={{ height: Math.max(4, (f.deposit / maxFlow) * 120) + "px" }}
                        title={"Deposits " + fmt0(f.deposit)}
                      />
                      <div
                        className="w-[45%] rounded-t-[6px] bg-[linear-gradient(180deg,#d4a94f_0%,#a9791c_100%)] transition-all duration-300"
                        style={{ height: Math.max(4, (f.withdraw / maxFlow) * 120) + "px" }}
                        title={"Withdrawals " + fmt0(f.withdraw)}
                      />
                    </div>
                    <div className="text-[10.5px] font-bold text-muted-rose">{f.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top investors */}
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-rose bg-[#fbf3f4] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-[#a9791c]" />
                  <div className="font-display text-[15.5px] font-bold text-ink">Top Investors</div>
                </div>
                <span className="rounded-full bg-[#fdf6e4] px-2.5 py-1 text-[10.5px] font-extrabold text-[#a9791c]">
                  {data.topUsers.length}
                </span>
              </div>
              {data.topUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted-rose">
                  No investors yet
                </div>
              ) : (
                <div>
                  {data.topUsers.map((u, i) => (
                    <div
                      key={u.phone || i}
                      className="flex items-center gap-3 border-b border-[#f7ecef] px-5 py-3 last:border-b-0"
                    >
                      <div
                        className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${
                          i === 0
                            ? "bg-[linear-gradient(135deg,#d4a94f,#a9791c)] text-white"
                            : "bg-[#f7e3e7] text-maroon-700"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-ink">
                          {u.name || u.phone}
                          {u.name ? <span className="font-semibold text-muted-rose"> · {u.phone}</span> : ""}
                        </div>
                        <div className="text-[11px] font-medium text-muted-rose">
                          {u.userid || "—"} · {u.plans} plan{u.plans > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-[13.5px] font-extrabold text-maroon-700">{fmt0(u.invested)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== RECENT ACTIVITY ===== */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Recent invests */}
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-rose bg-[#fbf3f4] px-5 py-3.5">
                <div className="font-display text-[15.5px] font-bold text-ink">Recent Purchases</div>
                <span className="rounded-full bg-[#f7e3e7] px-2.5 py-1 text-[10.5px] font-extrabold text-maroon-700">
                  {data.recentInvests.length}
                </span>
              </div>
              {data.recentInvests.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted-rose">
                  No purchases yet
                </div>
              ) : (
                <div>
                  {data.recentInvests.map((inv) => (
                    <div
                      key={inv._id}
                      className="flex items-center gap-3 border-b border-[#f7ecef] px-5 py-3 last:border-b-0"
                    >
                      <div className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] ${inv.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[#f7e3e7] text-maroon-600"}`}>
                        {inv.vip ? <Crown size={18} /> : <ShoppingBag size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          {inv.planName} <span className="font-semibold text-muted-rose">· {inv.phone}</span>
                        </div>
                        <div className="text-[11.5px] font-medium text-muted-rose">{fmtD(inv.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-extrabold text-maroon-700">{fmt0(inv.price)}</div>
                        <div className="text-[10.5px] font-semibold text-[#16a34a]">{fmt0(inv.daily)}/day</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent withdrawals */}
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-rose bg-[#fbf3f4] px-5 py-3.5">
                <div className="font-display text-[15.5px] font-bold text-ink">Recent Withdrawals</div>
                <span className="rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[10.5px] font-extrabold text-[#a9791c]">
                  {data.recentWithdrawals.length}
                </span>
              </div>
              {data.recentWithdrawals.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted-rose">
                  No withdrawals yet
                </div>
              ) : (
                <div>
                  {data.recentWithdrawals.map((w) => (
                    <div
                      key={w._id}
                      className="flex items-center gap-3 border-b border-[#f7ecef] px-5 py-3 last:border-b-0"
                    >
                      <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] bg-[#eafaf0] text-[#16a34a]">
                        <ArrowUpFromLine size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          {w.phone} <span className="font-semibold text-muted-rose">· {w.bankName}</span>
                        </div>
                        <div className="text-[11.5px] font-medium text-muted-rose">{fmtD(w.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="text-[14px] font-extrabold text-ink">{fmt0(w.amount)}</div>
                        <Pill value={w.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
