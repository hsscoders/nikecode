"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ScrollText } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmtD } from "../../../lib/api";
import { Loader, Toast, useToast, Pagination } from "../../../components/ui";

/* ============================================================
   AUDIT LOG — full website activity trail.
   Every admin money action, user auth event, money request and
   gateway settlement lands here from the backend (services/audit.js).
   Read-only: filter, search, page — never edit or delete.
   ============================================================ */

const CATEGORIES = [
  "All",
  "auth",
  "deposit",
  "withdraw",
  "invest",
  "user",
  "plan",
  "banner",
  "settings",
  "gateway",
  "system",
];

const ACTOR_TYPES = ["All", "admin", "user", "system"];

/* category chip colors */
const CAT_STYLE = {
  auth: "bg-[#eef4ff] text-[#2563eb]",
  deposit: "bg-[#eafaf0] text-[#16a34a]",
  withdraw: "bg-[#fdecec] text-[#dc2626]",
  invest: "bg-[#f3e8ff] text-[#7c3aed]",
  user: "bg-[#fdf3e0] text-[#a9791c]",
  plan: "bg-[#e0f7fa] text-[#00838f]",
  banner: "bg-[#fce7f3] text-[#be185d]",
  settings: "bg-[#f0f0f0] text-[#555555]",
  gateway: "bg-[#ecfdf5] text-[#0d9488]",
  system: "bg-[var(--color-tint2)] text-brand-700",
};

const ACTION_LABELS = {
  "admin.login": "Admin Login",
  "admin.login_failed": "Login Failed",
  "user.register": "Register",
  "user.login": "User Login",
  "user.login_failed": "Login Failed",
  "deposit.request": "Recharge Request",
  "deposit.approve": "Deposit Approved",
  "deposit.rejected": "Deposit Rejected",
  "deposit.pending": "Deposit → Pending",
  "deposit.manual_add": "Manual Deposit",
  "withdraw.request": "Withdraw Request",
  "withdraw.success": "Withdraw Paid",
  "withdraw.rejected": "Withdraw Rejected",
  "withdraw.processing": "Withdraw Processing",
  "withdraw.pending": "Withdraw → Pending",
  "withdraw.auto_payout": "Auto Payout",
  "invest.purchase": "Plan Purchased",
  "bank.save": "Bank Card Saved",
  "user.update": "User Edited",
  "user.ban": "User Banned",
  "user.unban": "User Unbanned",
  "user.onelogin": "One-Click Login",
  "plan.create": "Plan Created",
  "plan.update": "Plan Updated",
  "plan.delete": "Plan Deleted",
  "banner.create": "Banner Created",
  "banner.update": "Banner Updated",
  "banner.delete": "Banner Deleted",
  "settings.update": "Settings Saved",
  "commission.update": "Commission Saved",
  "gateway.order_created": "Gateway Order",
  "gateway.payin_success": "Payment Credited",
};

const labelFor = (action) => ACTION_LABELS[action] || action;

export default function AuditLogPage() {
  const [logs, setLogs] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("All");
  const [actorType, setActorType] = useState("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { toast, showToast, isError } = useToast();

  const load = useCallback(
    async (p = 1, cat = category, actor = actorType, q = query) => {
      try {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("limit", "50");
        if (cat !== "All") params.set("category", cat);
        if (actor !== "All") params.set("actorType", actor);
        if (q) params.set("search", q);
        const d = await api("/api/admin/audit?" + params.toString());
        setLogs(d.logs);
        setTotal(d.total);
        setPages(d.pages);
        setPage(d.page);
      } catch (e) {
        showToast(e.message, true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, actorType, query]
  );

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, actorType, query]);

  const goPage = (p) => {
    if (p < 1 || p > pages || p === page) return;
    load(p);
  };

  const actorChip = (l) =>
    l.actorType === "admin"
      ? "bg-[var(--color-tint2)] text-brand-800"
      : l.actorType === "user"
      ? "bg-[#eef4ff] text-[#2563eb]"
      : "bg-[#f0f0f0] text-[#555555]";

  return (
    <AdminShell
      title="Audit Log"
      sub="Full website activity — every admin action, user event and gateway settlement, recorded permanently"
    >
      <Toast message={toast} isError={isError} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 sm:max-w-[320px]">
          <Search size={16} className="shrink-0 text-icon" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-none placeholder:text-muted sm:text-[13.5px]"
            placeholder="Search action / user / message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(search);
              }
            }}
          />
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => load(page)}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
        <span className="ml-auto hidden rounded-full bg-[var(--color-tint2)] px-3 py-1.5 text-[11.5px] font-extrabold text-brand-700 sm:inline">
          {total} events
        </span>
      </div>

      {/* Filters — actor type + category chips */}
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2">
          {ACTOR_TYPES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActorType(a)}
              className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.4px] transition-all ${
                actorType === a
                  ? "brand-grad text-white shadow-[0_4px_12px_var(--s-btn,rgba(79,70,229,0.3))]"
                  : "border border-line bg-white text-[#475569] hover:bg-[var(--color-tint2)]"
              }`}
            >
              {a === "All" ? "Everyone" : a + " only"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:pb-0">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold transition-all ${
                category === c
                  ? "brand-grad text-white shadow-[0_4px_12px_var(--s-btn,rgba(79,70,229,0.3))]"
                  : "border border-line bg-white text-[#475569] hover:bg-[var(--color-tint2)]"
              }`}
            >
              {c === "All" ? "All Categories" : c}
            </button>
          ))}
        </div>
      </div>

      {!logs ? (
        <Loader label="Loading activity trail..." />
      ) : logs.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-line bg-white/60">
          <ScrollText size={34} className="text-[#d8bfc6]" />
          <div className="text-[14px] font-bold text-[#475569]">No activity found</div>
          <div className="text-[12.5px] text-muted">
            Events appear here as admins and users act on the site
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_4px_24px_rgba(49,46,129,0.06)] md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line bg-[var(--color-tint)] text-[10.5px] font-extrabold uppercase tracking-[0.8px] text-muted">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id} className="border-b border-line/60 last:border-0 hover:bg-[var(--color-tint)]">
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-[#475569]">
                      {fmtD(l.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.5px] ${actorChip(l)}`}
                        >
                          {l.actorType}
                        </span>
                        <span className="text-[12.5px] font-bold text-ink">
                          {l.actorLabel || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.4px] ${
                          CAT_STYLE[l.category] || CAT_STYLE.system
                        }`}
                      >
                        {l.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12.5px] font-bold text-ink">
                        {labelFor(l.action)}
                      </div>
                      <div className="mt-0.5 max-w-[520px] truncate text-[11.5px] text-muted">
                        {l.message || l.target}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11.5px] font-medium text-muted">
                      {l.ip || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {logs.map((l) => (
              <div
                key={l._id}
                className="rounded-[14px] border border-line bg-white p-3.5 shadow-[0_3px_14px_rgba(49,46,129,0.05)]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.5px] ${
                      CAT_STYLE[l.category] || CAT_STYLE.system
                    }`}
                  >
                    {labelFor(l.action)}
                  </span>
                  <span className="text-[10.5px] font-semibold text-muted">
                    {fmtD(l.createdAt)}
                  </span>
                </div>
                <div className="text-[13px] font-semibold leading-snug text-ink">
                  {l.message || l.target}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-extrabold uppercase ${actorChip(l)}`}
                  >
                    {l.actorType}
                  </span>
                  <span className="font-bold">{l.actorLabel || "—"}</span>
                  {l.ip && <span className="ml-auto">{l.ip}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination — numbered, shared component (server-side pages) */}
          <Pagination
            page={page - 1}
            pages={pages}
            onPage={(p) => goPage(p + 1)}
            total={total}
          />
        </>
      )}
    </AdminShell>
  );
}
