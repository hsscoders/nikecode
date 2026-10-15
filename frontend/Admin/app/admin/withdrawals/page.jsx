"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  XCircle,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  Zap,
  Radar,
  CheckCircle2,
} from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtD } from "../../../lib/api";
import {
  Modal,
  Pill,
  Loader,
  Toast,
  useToast,
  Pagination,
} from "../../../components/ui";

const TABS = ["All", "Pending", "Processing", "Success", "Rejected"];

/* gateway registry labels — kept in sync with backend services/gateways.js
   (the /payout-gateways response also carries labels; this map covers rows
   before the list loads) */
const GW_LABEL = { qwackpay: "QwackPay", okpay: "OKPay" };
const gwLabel = (id) => GW_LABEL[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : "Gateway");

export default function WithdrawalsPage() {
  const [wds, setWds] = useState(null);
  const [tab, setTab] = useState("All");
  const [page, setPage] = useState(0);
  const PER = 20;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null); // { wd, action } (manual actions)
  const [payDlg, setPayDlg] = useState(null); // { wd } — auto payout dialog
  const [payGw, setPayGw] = useState("qwackpay"); // gateway picked in the dialog
  const [payBusy, setPayBusy] = useState(false);
  const [busyId, setBusyId] = useState(null); // row-level busy (check status)
  const [gwList, setGwList] = useState(null); // registry gateways + live balances
  const [selGw, setSelGw] = useState("qwackpay"); // toolbar gateway menu (session default)
  const { toast, showToast, isError } = useToast();

  const readyGws = (gwList || []).filter((g) => g.ready);
  const autoOn = readyGws.length > 0;

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/withdrawals" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setWds(d.withdrawals);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  /* gateway menu payload — who can pay right now + live balances */
  const loadGateways = async () => {
    try {
      const d = await api("/api/admin/payout-gateways");
      const list = d.gateways || [];
      setGwList(list);
      const def = list.find((g) => g.isDefault);
      setSelGw((cur) => (list.some((g) => g.id === cur && g.ready) ? cur : def && def.ready ? def.id : list.find((g) => g.ready)?.id || cur));
    } catch (e) {
      setGwList([]);
    }
  };

  useEffect(() => {
    load();
    loadGateways();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = { All: (wds || []).length };
  for (const t of ["Pending", "Processing", "Success", "Rejected"])
    counts[t] = (wds || []).filter((w) => w.status === t).length;

  const filtered = (wds || []).filter((w) => tab === "All" || w.status === tab);
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const safePage = Math.min(page, pages - 1);
  const rows = filtered.slice(safePage * PER, safePage * PER + PER);

  const switchTab = (t) => {
    setTab(t);
    setPage(0); /* fresh filter — back to the first page */
  };

  /* manual status actions (Approve / Reject / Processing) */
  const applyAction = async () => {
    const { wd, action } = confirm;
    try {
      await api("/api/admin/withdrawals/" + wd._id, {
        method: "PUT",
        body: JSON.stringify({ status: action }),
      });
      showToast(
        action === "Success"
          ? "Withdrawal marked as Success"
          : action === "Rejected"
          ? "Withdrawal rejected — balance refunded"
          : "Withdrawal marked as Processing"
      );
      setConfirm(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  /* AUTO PAYOUT — sends through the gateway picked in the dialog */
  const submitAutoPay = async () => {
    if (!payDlg || payBusy) return;
    setPayBusy(true);
    try {
      const d = await api("/api/admin/withdrawals/" + payDlg.wd._id + "/auto-pay", {
        method: "POST",
        body: JSON.stringify({ gateway: payGw }),
      });
      showToast(d.message || "Auto payout submitted — money is being sent to the bank account");
      setPayDlg(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setPayBusy(false);
    }
  };

  /* ask the gateway for the live payout status and settle the row */
  const checkStatus = async (wd) => {
    setBusyId(wd._id);
    try {
      const d = await api("/api/admin/withdrawals/" + wd._id + "/payout-status", {
        method: "POST",
      });
      showToast(d.message || "Status checked");
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setBusyId(null);
    }
  };

  const actionsFor = (w) => {
    if (w.status === "Pending" || w.status === "Processing") {
      const acts = [];
      if (autoOn)
        acts.push({
          key: "auto-pay",
          label: "Auto Pay",
          cls: "brand-grad text-white hover:brightness-110",
          Icon: Zap,
        });
      if (w.status === "Pending")
        acts.push({
          key: "Processing",
          label: "Processing",
          cls: "bg-[#e8f0fe] text-[#2563eb] hover:bg-[#dbe8fd]",
          Icon: Clock3,
        });
      acts.push({
        key: "Success",
        label: "Approve",
        cls: "bg-[#eafaf0] text-[#16a34a] hover:bg-[#d9f5e5]",
        Icon: CircleCheck,
      });
      acts.push({
        key: "Rejected",
        label: "Reject",
        cls: "bg-[#fdecec] text-[#dc2626] hover:bg-[#fbdcdc]",
        Icon: XCircle,
      });
      return acts;
    }
    return null;
  };

  const onAction = (w, key) => {
    if (key === "auto-pay") {
      setPayGw(selGw); /* preselect the toolbar choice */
      setPayDlg({ wd: w });
      return;
    }
    setConfirm({ wd: w, action: key });
  };

  const money = (v) =>
    "\u20B9" + Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <AdminShell title="Withdrawals" sub="Payout requests — pick a gateway and pay automatically, or approve manually. Rejecting refunds the user's balance">
      <Toast message={toast} isError={isError} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 sm:max-w-[320px]">
          <Search size={16} className="shrink-0 text-icon" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-none placeholder:text-muted sm:text-[13.5px]"
            placeholder="Search phone / userid..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setQuery(search);
                load(search);
              }
            }}
          />
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
        </button>
      </div>

      {/* Status tabs — single-line, swipeable on mobile */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-extrabold transition-all duration-150 ${
              tab === t
                ? "brand-grad text-white shadow-[0_6px_16px_var(--s-btn,rgba(79,70,229,0.3))]"
                : "border border-line bg-white text-[#475569] hover:bg-[var(--color-tint2)]"
            }`}
          >
            {t}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                tab === t ? "bg-white/20 text-white" : "bg-[var(--color-tint2)] text-brand-700"
              }`}
            >
              {counts[t] || 0}
            </span>
          </button>
        ))}
      </div>

      {!wds ? (
        <Loader />
      ) : (
        <>
        {/* MOBILE — compact card list (table hidden below sm) */}
        <div className="flex flex-col gap-2.5 sm:hidden">
          {rows.map((w) => {
            const acts = actionsFor(w);
            const canCheck = w.autoPayout && w.status === "Processing";
            return (
              <div key={w._id} className="admin-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[13.5px] font-extrabold text-ink">
                    +91 {w.phone}
                  </span>
                  <Pill value={w.status} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className="font-display text-[17px] font-extrabold leading-none text-brand-700">
                    {fmt0(w.netAmount ?? w.amount)}
                  </div>
                  <div className="shrink-0 text-[10.5px] font-medium text-muted">
                    {fmtD(w.createdAt)}
                  </div>
                </div>
                <div className="mt-1.5 text-[11.5px] font-semibold text-[#475569]">
                  {w.userid || "—"}
                  {w.charge ? " · Req " + fmt0(w.amount) + " · Fee " + fmt0(w.charge) : ""}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setView(w)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-brand-700 transition-colors hover:bg-[var(--color-tint2)]"
                  >
                    <Eye size={12} />
                    {w.bankName || "View"}
                  </button>
                  {w.autoPayout && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fdf6e4] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#8a6a1c]">
                      <Zap size={9} /> Auto · {gwLabel(w.gateway)}
                    </span>
                  )}
                  {w.autoPayout && w.utr && (
                    <span className="text-[9.5px] font-bold text-muted">
                      UTR {String(w.utr).slice(0, 10)}
                    </span>
                  )}
                </div>
                {acts || canCheck ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line/60 pt-2.5">
                    {acts &&
                      acts.map(({ key, label, cls, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onAction(w, key)}
                          className={`flex basis-[calc(50%-3px)] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-extrabold transition-colors ${cls}`}
                        >
                          <Icon size={13} />
                          {label}
                        </button>
                      ))}
                    {canCheck && (
                      <button
                        type="button"
                        onClick={() => checkStatus(w)}
                        disabled={busyId === w._id}
                        className="flex basis-[calc(50%-3px)] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#e8f0fe] px-2.5 py-2 text-[12px] font-extrabold text-[#2563eb] transition-colors hover:bg-[#dbe8fd] disabled:opacity-60"
                      >
                        <Radar size={13} className={busyId === w._id ? "animate-spin" : ""} />
                        {busyId === w._id ? "Checking..." : "Check Status"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5 border-t border-line/60 pt-2 text-[11.5px] font-semibold text-muted">
                    {w.processedAt ? "Processed " + fmtD(w.processedAt) : "—"}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="admin-card py-8 text-center text-[13px] font-medium text-muted">
              No withdrawals found
            </div>
          )}
        </div>

        {/* DESKTOP — full table */}
        <div className="admin-card hidden overflow-hidden sm:block">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>User ID</th>
                  <th>Amount</th>
                  <th>Bank</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w._id}>
                    <td className="whitespace-nowrap font-medium text-[#475569]">{fmtD(w.createdAt)}</td>
                    <td className="whitespace-nowrap font-bold text-ink">+91 {w.phone}</td>
                    <td className="font-semibold text-[#475569]">{w.userid || "—"}</td>
                    <td className="whitespace-nowrap">
                      <div className="font-extrabold text-brand-700">
                        {fmt0(w.netAmount ?? w.amount)}
                      </div>
                      <div className="text-[11px] font-semibold text-[#475569]">
                        Req {fmt0(w.amount)}
                        {w.charge ? " · Fee " + fmt0(w.charge) : ""}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setView(w)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] font-bold text-brand-700 transition-colors hover:bg-[var(--color-tint2)]"
                      >
                        <Eye size={13} />
                        {w.bankName || "View"}
                      </button>
                    </td>
                    <td>
                      <Pill value={w.status} />
                      {w.autoPayout && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#fdf6e4] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#8a6a1c]">
                            <Zap size={9} /> Auto · {gwLabel(w.gateway)}
                          </span>
                          {w.utr && (
                            <span className="text-[9.5px] font-bold text-muted">
                              UTR {String(w.utr).slice(0, 10)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {actionsFor(w) ? (
                          actionsFor(w).map(({ key, label, cls, Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => onAction(w, key)}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition-colors ${cls}`}
                            >
                              <Icon size={13} />
                              {label}
                            </button>
                          ))
                        ) : (
                          <span className="text-[12px] font-semibold text-muted">
                            {w.processedAt ? "Processed " + fmtD(w.processedAt) : "—"}
                          </span>
                        )}
                        {w.autoPayout && w.status === "Processing" && (
                          <button
                            type="button"
                            onClick={() => checkStatus(w)}
                            disabled={busyId === w._id}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e8f0fe] px-3 py-1.5 text-[12px] font-extrabold text-[#2563eb] transition-colors hover:bg-[#dbe8fd] disabled:opacity-60"
                          >
                            <Radar size={13} className={busyId === w._id ? "animate-spin" : ""} />
                            {busyId === w._id ? "Checking..." : "Check Status"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[13.5px] font-medium text-muted">
                      No withdrawals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        <Pagination page={safePage} pages={pages} onPage={setPage} total={filtered.length} />
        </>
      )}

      {/* ===== BANK DETAILS VIEW ===== */}
      <Modal
        open={!!view}
        title="Withdrawal Details"
        sub={view ? "+91 " + view.phone + " · " + fmt0(view.amount) : ""}
        onClose={() => setView(null)}
      >
        {view && (
          <div className="flex flex-col gap-3">
            {[
              { lbl: "Real Name", val: view.realName },
              { lbl: "Bank Name", val: view.bankName },
              { lbl: "Account Number", val: view.account },
              { lbl: "IFSC Code", val: view.ifsc },
              { lbl: "Requested Amount", val: fmt0(view.amount) },
              {
                lbl: "Charge" + (view.chargePercent ? " (" + view.chargePercent + "%)" : ""),
                val: view.charge ? "− " + fmt0(view.charge) : "—",
              },
              { lbl: "Net Payable", val: fmt0(view.netAmount ?? view.amount) },
              {
                lbl: "Payout Mode",
                val: view.autoPayout ? "Automatic (" + gwLabel(view.gateway) + ")" : "Manual",
              },
              { lbl: "Payout Order ID", val: view.payoutOrderId || "—" },
              { lbl: "UTR / Reference", val: view.utr || "—" },
              { lbl: "Requested At", val: fmtD(view.createdAt) },
              { lbl: "Processed At", val: view.processedAt ? fmtD(view.processedAt) : "—" },
              ...(view.note ? [{ lbl: "Note", val: view.note }] : []),
            ].map(({ lbl, val }) => (
              <div key={lbl} className="flex items-start justify-between gap-4 border-b border-line/60 pb-2.5 last:border-b-0">
                <span className="shrink-0 text-[12.5px] font-semibold text-muted">{lbl}</span>
                <span className="break-all text-right text-[13.5px] font-bold text-ink">{val || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ===== AUTO PAYOUT DIALOG — pick the gateway, then send ===== */}
      <Modal
        open={!!payDlg}
        title="Auto Payout"
        sub={payDlg ? "+91 " + payDlg.wd.phone + " · " + fmt0(payDlg.wd.netAmount ?? payDlg.wd.amount) : ""}
        onClose={() => (payBusy ? null : setPayDlg(null))}
      >
        {payDlg && (
          <div className="flex flex-col gap-4">
            {/* beneficiary summary */}
            <div className="rounded-xl bg-[var(--color-tint)] px-3 py-2.5 sm:px-4 sm:py-3 text-[12.5px] font-medium leading-relaxed text-[#475569]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-ink">{payDlg.wd.realName || "Beneficiary"}</span>
                <span className="font-display text-[15px] font-extrabold text-brand-700">
                  {fmt0(payDlg.wd.netAmount ?? payDlg.wd.amount)}
                </span>
              </div>
              <div className="mt-1">
                {payDlg.wd.bankName || "Bank"} · account{" "}
                <span className="font-bold">••••{String(payDlg.wd.account || "").slice(-4)}</span> · IFSC{" "}
                <span className="font-bold">{payDlg.wd.ifsc || "—"}</span>
              </div>
            </div>

            {/* gateway picker — clickable chips, same style as the toolbar */}
            <div>
              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.4px] text-muted">
                Pay via Gateway
              </label>
              <div className="flex flex-wrap gap-2">
                {readyGws.map((g) => {
                  const active = payGw === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPayGw(g.id)}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-[12.5px] font-extrabold sm:px-4 sm:py-2.5 sm:text-[13px] transition-all duration-150 ${
                        active
                          ? "border-brand-700 brand-grad text-white shadow-[0_6px_16px_var(--s-btn,rgba(79,70,229,0.3))]"
                          : "border-line bg-white text-ink hover:border-brand-700/40"
                      }`}
                    >
                      {active ? <CheckCircle2 size={15} /> : <Zap size={14} className="text-brand-600" />}
                      {g.label}
                      {g.balance ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-[#eafaf0] text-[#16a34a]"}`}>
                          {money(g.balance.available)} avail.
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[11.5px] font-medium text-muted">
                The gateway settles the payout automatically through its signed
                webhook and refunds the user instantly if it fails.
              </div>
            </div>

            {/* insufficient-balance warning */}
            {(() => {
              const info = readyGws.find((g) => g.id === payGw);
              const net = Number(payDlg.wd.netAmount ?? payDlg.wd.amount) || 0;
              if (info && info.balance && Number(info.balance.available) < net)
                return (
                  <div className="flex items-start gap-2.5 rounded-xl border border-[#f3c8c8] bg-[#fdecec] px-3 py-2.5 sm:px-4 sm:py-3 text-[12.5px] font-semibold text-[#b91c1c]">
                    <XCircle size={15} className="mt-0.5 shrink-0" />
                    {info.label} balance ({money(info.balance.available)}) is lower than the payout amount — fund the gateway wallet first or pay manually.
                  </div>
                );
              return null;
            })()}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setPayDlg(null)}
                disabled={payBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary px-6"
                onClick={submitAutoPay}
                disabled={payBusy}
              >
                <Zap size={15} />
                {payBusy ? "Sending..." : "Send Money"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== MANUAL ACTION CONFIRM ===== */}
      <Modal
        open={!!confirm}
        title={
          confirm?.action === "Success"
            ? "Approve Withdrawal"
            : confirm?.action === "Rejected"
            ? "Reject Withdrawal"
            : "Mark Processing"
        }
        onClose={() => setConfirm(null)}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`admin-btn ${confirm?.action === "Rejected" ? "admin-btn-danger" : "admin-btn-primary"}`}
              onClick={applyAction}
            >
              {confirm?.action === "Success"
                ? "Approve"
                : confirm?.action === "Rejected"
                ? "Reject"
                : "Processing"}
            </button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-[#475569]">
          {confirm
            ? `${fmt0(confirm.wd.netAmount ?? confirm.wd.amount)} withdrawal of +91 ${confirm.wd.phone} — ${
                confirm.action === "Success"
                  ? "will be approved — amount will be marked as paid."
                  : confirm.action === "Rejected"
                  ? "will be rejected — amount will be refunded to the user's balance."
                  : "will be moved to Processing."
              }`
            : ""}
        </p>
      </Modal>
    </AdminShell>
  );
}
