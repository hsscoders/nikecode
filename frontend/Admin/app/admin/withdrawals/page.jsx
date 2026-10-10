"use client";

import { useEffect, useState } from "react";
import { CircleCheck, XCircle, Clock3, Eye, RefreshCw, Search, ArrowUpFromLine } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtD } from "../../../lib/api";
import {
  Modal,
  Pill,
  Confirm,
  Loader,
  Toast,
  useToast,
} from "../../../components/ui";

const TABS = ["All", "Pending", "Processing", "Success", "Rejected"];

export default function WithdrawalsPage() {
  const [wds, setWds] = useState(null);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null); // { wd, action }
  const { toast, showToast, isError } = useToast();

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/withdrawals" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setWds(d.withdrawals);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = { All: (wds || []).length };
  for (const t of ["Pending", "Processing", "Success", "Rejected"])
    counts[t] = (wds || []).filter((w) => w.status === t).length;

  const filtered = (wds || []).filter((w) => tab === "All" || w.status === tab);

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

  const actionsFor = (w) => {
    if (w.status === "Pending")
      return [
        { key: "Processing", label: "Processing", cls: "bg-[#e8f0fe] text-[#2563eb] hover:bg-[#dbe8fd]", Icon: Clock3 },
        { key: "Success", label: "Approve", cls: "bg-[#eafaf0] text-[#16a34a] hover:bg-[#d9f5e5]", Icon: CircleCheck },
        { key: "Rejected", label: "Reject", cls: "bg-[#fdecec] text-[#dc2626] hover:bg-[#fbdcdc]", Icon: XCircle },
      ];
    if (w.status === "Processing")
      return [
        { key: "Success", label: "Approve", cls: "bg-[#eafaf0] text-[#16a34a] hover:bg-[#d9f5e5]", Icon: CircleCheck },
        { key: "Rejected", label: "Reject", cls: "bg-[#fdecec] text-[#dc2626] hover:bg-[#fbdcdc]", Icon: XCircle },
      ];
    return null;
  };

  return (
    <AdminShell title="Withdrawals" sub="Payout requests — rejecting refunds the amount to the user's balance">
      <Toast message={toast} isError={isError} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-line-rose bg-white px-3.5 py-2.5 sm:max-w-[320px]">
          <Search size={16} className="shrink-0 text-icon-rose" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium text-ink outline-none placeholder:text-[#c4a9b0]"
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

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-full px-4 py-2 text-[12.5px] font-extrabold transition-all duration-150 ${
              tab === t
                ? "bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-white shadow-[0_6px_16px_rgba(124,29,51,0.3)]"
                : "border border-line-rose bg-white text-[#7d6a6e] hover:bg-[#fbf1f3]"
            }`}
          >
            {t}
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                tab === t ? "bg-white/20 text-white" : "bg-[#f7e3e7] text-maroon-700"
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
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[980px]">
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
                {filtered.map((w) => (
                  <tr key={w._id}>
                    <td className="whitespace-nowrap font-medium text-[#7d6a6e]">{fmtD(w.createdAt)}</td>
                    <td className="font-bold text-ink">+91 {w.phone}</td>
                    <td className="font-semibold text-[#7d6a6e]">{w.userid || "—"}</td>
                    <td className="font-extrabold text-maroon-700">{fmt0(w.amount)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setView(w)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-rose bg-white px-2.5 py-1.5 text-[12px] font-bold text-maroon-700 transition-colors hover:bg-[#fbf1f3]"
                      >
                        <Eye size={13} />
                        {w.bankName || "View"}
                      </button>
                    </td>
                    <td>
                      <Pill value={w.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {actionsFor(w) ? (
                          actionsFor(w).map(({ key, label, cls, Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setConfirm({ wd: w, action: key })}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition-colors ${cls}`}
                            >
                              <Icon size={13} />
                              {label}
                            </button>
                          ))
                        ) : (
                          <span className="text-[12px] font-semibold text-muted-rose">
                            {w.processedAt ? "Processed " + fmtD(w.processedAt) : "—"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[13.5px] font-medium text-muted-rose">
                      No withdrawals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
              { lbl: "Requested At", val: fmtD(view.createdAt) },
              { lbl: "Processed At", val: view.processedAt ? fmtD(view.processedAt) : "—" },
            ].map(({ lbl, val }) => (
              <div key={lbl} className="flex items-start justify-between gap-4 border-b border-line-rose/60 pb-2.5 last:border-b-0">
                <span className="shrink-0 text-[12.5px] font-semibold text-muted-rose">{lbl}</span>
                <span className="break-all text-right text-[13.5px] font-bold text-ink">{val || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ===== ACTION CONFIRM ===== */}
      <Confirm
        open={!!confirm}
        danger={confirm?.action === "Rejected"}
        title={
          confirm?.action === "Success"
            ? "Approve Withdrawal"
            : confirm?.action === "Rejected"
            ? "Reject Withdrawal"
            : "Mark Processing"
        }
        confirmLabel={confirm?.action === "Success" ? "Approve" : confirm?.action === "Rejected" ? "Reject" : "Processing"}
        message={
          confirm
            ? `${fmt0(confirm.wd.amount)} withdrawal request of +91 ${confirm.wd.phone}${
                confirm.action === "Success"
                  ? " will be approved — amount will be marked as paid."
                  : confirm.action === "Rejected"
                  ? " will be rejected — amount will be refunded to the user's balance."
                  : " will be moved to Processing."
              }`
            : ""
        }
        onCancel={() => setConfirm(null)}
        onConfirm={applyAction}
      />
    </AdminShell>
  );
}
