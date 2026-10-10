"use client";

import { useEffect, useState } from "react";
import { Plus, CircleCheck, XCircle, RefreshCw, Search, ArrowDownToLine } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtD } from "../../../lib/api";
import {
  Modal,
  Pill,
  Field,
  TextInput,
  Select,
  Confirm,
  Loader,
  Toast,
  useToast,
} from "../../../components/ui";

const TABS = ["All", "Pending", "Success", "Rejected"];

export default function DepositsPage() {
  const [deposits, setDeposits] = useState(null);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [addModal, setAddModal] = useState(false);

  /* add-deposit form */
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Pay-T");
  const [status, setStatus] = useState("Pending");
  const [saving, setSaving] = useState(false);

  /* approve / reject confirm */
  const [confirm, setConfirm] = useState(null); // { deposit, action }

  const { toast, showToast, isError } = useToast();

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/deposits" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setDeposits(d.deposits);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* user picker search */
  useEffect(() => {
    if (!addModal) return;
    const t = setTimeout(async () => {
      if (!userSearch.trim()) {
        setUserResults([]);
        return;
      }
      try {
        const d = await api("/api/admin/users?search=" + encodeURIComponent(userSearch.trim()));
        setUserResults(d.users.slice(0, 5));
      } catch {
        setUserResults([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, addModal]);

  const counts = { All: (deposits || []).length };
  for (const t of ["Pending", "Success", "Rejected"])
    counts[t] = (deposits || []).filter((d) => d.status === t).length;

  const filtered = (deposits || []).filter((d) => tab === "All" || d.status === tab);

  const openAdd = () => {
    setPicked(null);
    setUserSearch("");
    setUserResults([]);
    setAmount("");
    setMethod("Pay-T");
    setStatus("Pending");
    setAddModal(true);
  };

  const saveDeposit = async () => {
    if (!picked) return showToast("Select a user", true);
    if (!amount || Number(amount) <= 0) return showToast("Enter an amount", true);
    setSaving(true);
    try {
      await api("/api/admin/deposits", {
        method: "POST",
        body: JSON.stringify({
          userId: picked._id,
          amount: Number(amount),
          method,
          status,
        }),
      });
      showToast(status === "Success" ? "Deposit added + recharge credited" : "Deposit request added");
      setAddModal(false);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const applyAction = async () => {
    const { deposit, action } = confirm;
    try {
      await api("/api/admin/deposits/" + deposit._id, {
        method: "PUT",
        body: JSON.stringify({ status: action }),
      });
      showToast(
        action === "Success"
          ? "Deposit approved — recharge balance credited"
          : "Deposit rejected"
      );
      setConfirm(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  return (
    <AdminShell title="Deposits" sub="Recharge requests — approving credits the user's recharge balance">
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
        <button type="button" className="admin-btn admin-btn-primary" onClick={openAdd}>
          <Plus size={16} />
          Add Deposit
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

      {!deposits ? (
        <Loader />
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>User ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d._id}>
                    <td className="whitespace-nowrap font-medium text-[#7d6a6e]">{fmtD(d.createdAt)}</td>
                    <td className="font-bold text-ink">+91 {d.phone}</td>
                    <td className="font-semibold text-[#7d6a6e]">{d.userid || "—"}</td>
                    <td className="font-extrabold text-maroon-700">{fmt0(d.amount)}</td>
                    <td className="font-semibold text-ink">{d.method}</td>
                    <td>
                      <Pill value={d.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {d.status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirm({ deposit: d, action: "Success" })}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#eafaf0] px-3 py-1.5 text-[12px] font-extrabold text-[#16a34a] transition-colors hover:bg-[#d9f5e5]"
                            >
                              <CircleCheck size={13} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm({ deposit: d, action: "Rejected" })}
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#fdecec] px-3 py-1.5 text-[12px] font-extrabold text-[#dc2626] transition-colors hover:bg-[#fbdcdc]"
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-[12px] font-semibold text-muted-rose">
                            {d.processedAt ? "Processed " + fmtD(d.processedAt) : "—"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[13.5px] font-medium text-muted-rose">
                      No deposits found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== ADD DEPOSIT MODAL ===== */}
      <Modal
        open={addModal}
        title="Add Deposit"
        sub="Manual recharge entry — with direct credit option"
        onClose={() => setAddModal(false)}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setAddModal(false)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={saveDeposit} disabled={saving}>
              {saving ? "Saving..." : "Add Deposit"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Select User" hint="Search by phone / userid / referral ID">
            {picked ? (
              <div className="flex items-center justify-between rounded-xl border border-maroon-600/40 bg-[#fbf1f3] px-4 py-3">
                <div>
                  <div className="text-[14px] font-bold text-ink">+91 {picked.phone}</div>
                  <div className="text-[11.5px] font-semibold text-muted-rose">
                    {picked.userid || "No ID"} · Bal {fmt0(picked.rechargeBalance)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="cursor-pointer text-[12px] font-extrabold text-maroon-700 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <TextInput
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user..."
                />
                {userResults.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-line-rose">
                    {userResults.map((u) => (
                      <button
                        key={u._id}
                        type="button"
                        onClick={() => {
                          setPicked(u);
                          setUserResults([]);
                          setUserSearch("");
                        }}
                        className="flex w-full cursor-pointer items-center justify-between border-b border-line-rose/60 bg-white px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[#fbf1f3]"
                      >
                        <span className="text-[13.5px] font-bold text-ink">+91 {u.phone}</span>
                        <span className="text-[11.5px] font-semibold text-muted-rose">
                          {u.userid || ""} {u.name ? "· " + u.name : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹)">
              <TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="600" />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="Pay-T">Pay-T</option>
                <option value="Pay-D">Pay-D</option>
                <option value="Pay-M">Pay-M</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </Select>
            </Field>
          </div>
          <Field label="Status" hint="Selecting Success credits the recharge balance instantly">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Pending">Pending (approve later)</option>
              <option value="Success">Success (direct credit)</option>
            </Select>
          </Field>
          <div className="flex items-center gap-2 rounded-xl bg-[#fdf6e4] px-4 py-3 text-[12.5px] font-semibold text-[#a9791c]">
            <ArrowDownToLine size={15} className="shrink-0" />
            Approved amount is added to the user's Recharge Balance (used for plan purchases)
          </div>
        </div>
      </Modal>

      {/* ===== APPROVE / REJECT CONFIRM ===== */}
      <Confirm
        open={!!confirm}
        danger={confirm?.action === "Rejected"}
        title={confirm?.action === "Success" ? "Approve Deposit" : "Reject Deposit"}
        confirmLabel={confirm?.action === "Success" ? "Approve" : "Reject"}
        message={
          confirm
            ? `${confirm.action === "Success" ? "Approve" : "Reject"} ${fmt0(
                confirm.deposit.amount
              )} deposit of +91 ${confirm.deposit.phone}?${
                confirm.action === "Success"
                  ? " Recharge balance will be credited."
                  : " No balance change will be made."
              }`
            : ""
        }
        onCancel={() => setConfirm(null)}
        onConfirm={applyAction}
      />
    </AdminShell>
  );
}
