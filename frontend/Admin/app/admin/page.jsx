"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  ChevronRight,
  BellRing,
} from "lucide-react";
import AdminShell from "../../components/AdminShell";
import { api, fmt0, fmtD } from "../../lib/api";
import { Pill, Loader, Toast, useToast } from "../../components/ui";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const { toast, showToast, isError } = useToast();

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await api("/api/admin/dashboard");
      setData(d);
      setLastUp(new Date());
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* auto-refresh every 30s — the panel stays current without manual reloads */
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const st = data?.stats;
  const maxChart = data ? Math.max(1, ...data.chart.map((c) => c.count)) : 1;
  const maxFlow = data ? Math.max(1, ...(data.flow || []).map((f) => Math.max(f.deposit, f.withdraw))) : 1;

  const cards = st
    ? [
        { lbl: "Total Users", val: st.totalUsers, sub: "+" + st.newUsers + " this week", Icon: Users, tile: "bg-[var(--color-tint2)] text-brand-600" },
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
        <div className="flex flex-col gap-3.5 sm:gap-5">
          {/* ===== TOOLBAR — refresh + last updated ===== */}
          <div className="flex items-center justify-between">
            <div className="text-[11.5px] font-semibold text-muted">
              {lastUp
                ? "Updated " +
                  new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  }).format(lastUp) +
                  " IST · auto-refreshes every 30s"
                : ""}
            </div>
            <button
              type="button"
              aria-label="Refresh dashboard"
              onClick={load}
              disabled={busy}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] font-extrabold text-brand-700 transition-colors hover:bg-[var(--color-tint2)] disabled:opacity-60"
            >
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* ===== PENDING APPROVALS — one-tap action strip ===== */}
          {(st.deposits?.Pending?.count > 0 || st.withdrawals?.Pending?.count > 0) && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
              {[
                { href: "/admin/deposits", lbl: "Pending Deposits", val: st.deposits?.Pending?.count || 0, amt: st.deposits?.Pending?.amount || 0, tile: "border-[#f3e2b5] bg-[#fdf6e4]", chip: "bg-[#a9791c]", Icon: ArrowDownToLine },
                { href: "/admin/withdrawals", lbl: "Pending Withdrawals", val: st.withdrawals?.Pending?.count || 0, amt: st.withdrawals?.Pending?.amount || 0, tile: "border-[#f3c4c4] bg-[#fdf1f1]", chip: "bg-[#b91c1c]", Icon: ArrowUpFromLine },
              ]
                .filter((q) => q.val > 0)
                .map((q) => (
                  <Link
                    key={q.lbl}
                    href={q.href}
                    className={`group flex items-center gap-3.5 rounded-[16px] border px-4 py-3.5 shadow-[0_6px_18px_rgba(49,46,129,0.08)] transition-all duration-150 hover:-translate-y-0.5 sm:px-5 ${q.tile}`}
                  >
                    <span className={`relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] bg-white ${q.chip === "bg-[#a9791c]" ? "text-[#a9791c]" : "text-[#b91c1c]"}`}>
                      <BellRing size={19} strokeWidth={2.1} />
                      <span className={`absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold text-white ${q.chip}`}>
                        {q.val}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[15px] font-bold text-ink">{q.lbl}</span>
                      <span className="mt-0.5 block text-[12px] font-semibold text-muted">
                        {fmt0(q.amt)} awaiting your action
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-extrabold text-brand-700">
                      Review
                      <ChevronRight size={15} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
            </div>
          )}

          {/* ===== TODAY STRIP — IST business day ===== */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
            {[
              { lbl: "Recharge Today", val: fmt0(st.today.recharge), Icon: ArrowDownToLine, tile: "bg-[#eafaf0] text-[#16a34a]" },
              { lbl: "Withdraw Today", val: fmt0(st.today.withdrawals), Icon: ArrowUpFromLine, tile: "bg-[var(--color-tint2)] text-brand-600" },
              { lbl: "New Users Today", val: st.today.users, Icon: Users, tile: "bg-[#fdf6e4] text-[#a9791c]" },
              { lbl: "Income Paid Today", val: fmt0(st.today.income), Icon: IndianRupee, tile: "bg-[#fdf3e0] text-[#a9791c]" },
            ].map(({ lbl, val, Icon, tile }) => (
              <div key={lbl} className="admin-card flex items-center gap-2.5 p-3 sm:gap-3.5 sm:p-4">
                <div className={`grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px] sm:h-[44px] sm:w-[44px] sm:rounded-[14px] ${tile}`}>
                  <Icon className="h-[17px] w-[17px] sm:h-5 sm:w-5" strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-[9px] font-bold uppercase tracking-[0.4px] text-muted sm:text-[10px] sm:tracking-[0.5px]">
                    <CalendarDays className="h-[10px] w-[10px] sm:h-[11px] sm:w-[11px]" />
                    {lbl}
                  </div>
                  <div className="mt-0.5 font-display text-[16px] font-bold leading-none text-ink sm:text-[21px]">{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ===== STAT CARDS ===== */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
            {cards.map(({ lbl, val, sub, Icon, tile }) => (
              <div
                key={lbl}
                className="admin-card flex items-center gap-2.5 p-3 transition-transform duration-150 hover:-translate-y-0.5 sm:gap-4 sm:p-4"
              >
                <div className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] sm:h-[52px] sm:w-[52px] sm:rounded-[16px] ${tile}`}>
                  <Icon className="h-[18px] w-[18px] sm:h-6 sm:w-6" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[9.5px] font-bold uppercase tracking-[0.3px] text-muted sm:text-[11px] sm:tracking-[0.5px]">
                    {lbl}
                  </div>
                  <div className="mt-0.5 font-display text-[17px] font-bold leading-none text-ink sm:text-[26px]">
                    {val}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] font-semibold text-muted sm:mt-1 sm:text-[11.5px]">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ===== CHART + QUICK ===== */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* 7-day registrations */}
            <div className="admin-card p-4 sm:p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] font-bold text-ink">
                    New Users — Last 7 Days
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted">
                    Daily registrations trend
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-tint2)] px-3 py-1.5 text-[12px] font-extrabold text-brand-700">
                  <TrendingUp size={14} />
                  {st.newUsers} total
                </div>
              </div>
              <div className="mt-5 flex h-[170px] items-end gap-2.5 sm:gap-4">
                {data.chart.map((c) => (
                  <div key={c.day} className="chart-col group flex flex-1 flex-col items-center gap-2">
                    <div className="text-[11px] font-extrabold text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
                      {c.count}
                    </div>
                    <div
                      className="bar-fill bar-primary w-full max-w-[46px] rounded-t-[8px] transition-all duration-300"
                      style={{ height: Math.max(6, (c.count / maxChart) * 120) + "px" }}
                    />
                    <div className="text-[10.5px] font-bold text-muted">{c.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet snapshot */}
            <div className="admin-hero relative overflow-hidden rounded-[18px] p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-[140px] w-[140px] rounded-full bg-accent/15 blur-2xl" />
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[1px] text-accent">
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
            <div className="admin-card p-4 sm:p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] font-bold text-ink">
                    Money Flow — Last 7 Days
                  </div>
                  <div className="mt-0.5 text-[12px] font-medium text-muted">
                    Successful deposits vs successful withdrawals
                  </div>
                </div>
                <div className="flex items-center gap-3.5 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-brand-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-700" /> Deposits
                  </span>
                  <span className="flex items-center gap-1.5 text-[#a9791c]">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Withdrawals
                  </span>
                </div>
              </div>
              <div className="mt-5 flex h-[170px] items-end gap-2.5 sm:gap-4">
                {(data.flow || []).map((f) => (
                  <div key={f.day} className="group flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-[120px] w-full max-w-[52px] items-end justify-center gap-1">
                      <div
                        className="bar-fill bar-primary w-[45%] rounded-t-[6px] transition-all duration-300"
                        style={{ height: Math.max(4, (f.deposit / maxFlow) * 120) + "px" }}
                        title={"Deposits " + fmt0(f.deposit)}
                      />
                      <div
                        className="bar-fill bar-accent w-[45%] rounded-t-[6px] transition-all duration-300"
                        style={{ height: Math.max(4, (f.withdraw / maxFlow) * 120) + "px" }}
                        title={"Withdrawals " + fmt0(f.withdraw)}
                      />
                    </div>
                    <div className="text-[10.5px] font-bold text-muted">{f.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top investors */}
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-[var(--color-tint)] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-[#a9791c]" />
                  <div className="font-display text-[15.5px] font-bold text-ink">Top Investors</div>
                </div>
                <span className="rounded-full bg-[#fdf6e4] px-2.5 py-1 text-[10.5px] font-extrabold text-[#a9791c]">
                  {data.topUsers.length}
                </span>
              </div>
              {data.topUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted">
                  No investors yet
                </div>
              ) : (
                <div>
                  {data.topUsers.map((u, i) => (
                    <div
                      key={u.phone || i}
                      className="flex items-center gap-3 border-b border-row px-5 py-3 last:border-b-0"
                    >
                      <div
                        className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${
                          i === 0
                            ? "bg-[linear-gradient(135deg,#fbbf24,#a9791c)] text-white"
                            : "bg-[var(--color-tint2)] text-brand-700"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-ink">
                          {u.name || u.phone}
                          {u.name ? <span className="font-semibold text-muted"> · {u.phone}</span> : ""}
                        </div>
                        <div className="text-[11px] font-medium text-muted">
                          {u.userid || "—"} · {u.plans} plan{u.plans > 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-[13.5px] font-extrabold text-brand-700">{fmt0(u.invested)}</div>
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
              <div className="flex items-center justify-between border-b border-line bg-[var(--color-tint)] px-5 py-3.5">
                <div className="font-display text-[15.5px] font-bold text-ink">Recent Purchases</div>
                <span className="rounded-full bg-[var(--color-tint2)] px-2.5 py-1 text-[10.5px] font-extrabold text-brand-700">
                  {data.recentInvests.length}
                </span>
              </div>
              {data.recentInvests.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted">
                  No purchases yet
                </div>
              ) : (
                <div>
                  {data.recentInvests.map((inv) => (
                    <div
                      key={inv._id}
                      className="flex items-center gap-3 border-b border-row px-5 py-3 last:border-b-0"
                    >
                      <div className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] ${inv.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-600"}`}>
                        {inv.vip ? <Crown size={18} /> : <ShoppingBag size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          {inv.planName} <span className="font-semibold text-muted">· {inv.phone}</span>
                        </div>
                        <div className="text-[11.5px] font-medium text-muted">{fmtD(inv.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[14px] font-extrabold text-brand-700">{fmt0(inv.price)}</div>
                        <div className="text-[10.5px] font-semibold text-[#16a34a]">{fmt0(inv.daily)}/day</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent withdrawals */}
            <div className="admin-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-[var(--color-tint)] px-5 py-3.5">
                <div className="font-display text-[15.5px] font-bold text-ink">Recent Withdrawals</div>
                <span className="rounded-full bg-[#fdf3e0] px-2.5 py-1 text-[10.5px] font-extrabold text-[#a9791c]">
                  {data.recentWithdrawals.length}
                </span>
              </div>
              {data.recentWithdrawals.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] font-medium text-muted">
                  No withdrawals yet
                </div>
              ) : (
                <div>
                  {data.recentWithdrawals.map((w) => (
                    <div
                      key={w._id}
                      className="flex items-center gap-3 border-b border-row px-5 py-3 last:border-b-0"
                    >
                      <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px] bg-[#eafaf0] text-[#16a34a]">
                        <ArrowUpFromLine size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          {w.phone} <span className="font-semibold text-muted">· {w.bankName}</span>
                        </div>
                        <div className="text-[11.5px] font-medium text-muted">{fmtD(w.createdAt)}</div>
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
