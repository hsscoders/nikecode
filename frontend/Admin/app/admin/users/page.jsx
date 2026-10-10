"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Pencil,
  Ban,
  ShieldCheck,
  LogIn,
  Users,
  RefreshCw,
  Eye,
  Landmark,
  Network,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtDate, fmtD } from "../../../lib/api";
import {
  Modal,
  Pill,
  Field,
  TextInput,
  Select,
  Loader,
  Toast,
  useToast,
} from "../../../components/ui";

const EMPTY_EDIT = {
  name: "",
  phone: "",
  userid: "",
  refId: "",
  refBy: "",
  balance: 0,
  rechargeBalance: 0,
  totalIncome: 0,
  status: "Active",
  password: "",
  withdrawPassword: "",
};

/* ===== small helpers for the details drawer ===== */

function SectionTitle({ Icon, children, right }) {
  return (
    <div className="mt-5 flex items-center justify-between border-t border-line-rose pt-4 first:mt-0 first:border-0 first:pt-0">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-maroon-700" />
        <span className="font-display text-[14.5px] font-bold text-maroon-700">{children}</span>
      </div>
      {right}
    </div>
  );
}

function InfoRow({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#fbf7f8] px-3 py-2">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.3px] text-[#8a6e75]">{k}</span>
      <span className="truncate text-[13px] font-bold text-ink">{v || "—"}</span>
    </div>
  );
}

function MiniTable({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line-rose">
      <table className="admin-table min-w-[560px]">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TeamBlock({ label, list }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-[#f7e3e7] px-2.5 py-1 text-[11px] font-extrabold text-maroon-700">
          {label} · {list.length}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
          No referrals at this level
        </div>
      ) : (
        <MiniTable head={["User ID", "Phone", "Wallet", "Income", "Status", "Joined"]}>
          {list.map((u) => (
            <tr key={u._id}>
              <td className="font-bold text-maroon-700">{u.userid || "—"}</td>
              <td className="whitespace-nowrap font-semibold text-ink">+91 {u.phone}</td>
              <td className="font-bold text-[#16a34a]">{fmt0(u.rechargeBalance)}</td>
              <td className="font-bold text-[#a9791c]">{fmt0(u.totalIncome)}</td>
              <td><Pill value={u.status} /></td>
              <td className="whitespace-nowrap text-[12px] text-[#7d6a6e]">{fmtDate(u.createdAt)}</td>
            </tr>
          ))}
        </MiniTable>
      )}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [details, setDetails] = useState(null);
  const { toast, showToast, isError } = useToast();

  const load = async (q = query) => {
    try {
      const d = await api("/api/admin/users" + (q ? "?search=" + encodeURIComponent(q) : ""));
      setUsers(d.users);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (u) => {
    setEdit(u);
    setForm({
      name: u.name || "",
      phone: u.phone,
      userid: u.userid || "",
      refId: u.refId || "",
      refBy: u.refBy || "",
      balance: u.balance,
      rechargeBalance: u.rechargeBalance,
      totalIncome: u.totalIncome,
      status: u.status,
      password: "",
      withdrawPassword: "",
    });
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!/^[6-9]\d{9}$/.test(form.phone))
      return showToast("Enter a valid 10-digit phone number", true);
    setSaving(true);
    try {
      await api("/api/admin/users/" + edit._id, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      showToast("User updated successfully");
      setEdit(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const toggleBan = async (u) => {
    try {
      await api("/api/admin/users/" + u._id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status: u.status === "Banned" ? "Active" : "Banned" }),
      });
      showToast(u.status === "Banned" ? "User unbanned" : "User banned");
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const openDetails = async (u) => {
    setViewUser(u);
    setDetails(null);
    try {
      const d = await api("/api/admin/users/" + u._id + "/details");
      setDetails(d);
    } catch (e) {
      showToast(e.message, true);
      setViewUser(null);
    }
  };

  /* One-click login — opens the user's app session directly in a new tab.
     The one-time code is exchanged for a 7-day session; no link is shown. */
  const oneClickLogin = async (u) => {
    /* open synchronously so the browser never blocks the popup */
    const win = window.open("", "_blank");
    try {
      const d = await api("/api/admin/users/" + u._id + "/onelogin", { method: "POST" });
      if (win) win.location = "/auto-login?code=" + encodeURIComponent(d.code);
      showToast("One-click login opened — session valid for 7 days");
    } catch (e) {
      if (win) win.close();
      showToast(e.message, true);
    }
  };

  const copyText = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(msg);
      } catch {
        showToast("Failed to copy", true);
      }
    }
  };

  return (
    <AdminShell title="Manage Users" sub="All users — wallets edit, ban/unban, one-click login">
      <Toast message={toast} isError={isError} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line-rose bg-white px-3.5 py-2.5 sm:max-w-[360px]">
          <Search size={16} className="shrink-0 text-icon-rose" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium text-ink outline-none placeholder:text-[#c4a9b0]"
            placeholder="Search phone / userid / refId..."
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
        <div className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <Users size={16} className="text-maroon-600" />
          {users ? users.length + " user(s)" : "—"}
        </div>
      </div>

      {!users ? (
        <Loader />
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[1050px]">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Referral ID</th>
                  <th>Phone</th>
                  <th>Referred By</th>
                  <th>Recharge Bal.</th>
                  <th>Withdraw Bal.</th>
                  <th>Total Income</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <span className="rounded-lg bg-[#f7e3e7] px-2.5 py-1 font-extrabold text-maroon-700">
                        {u.userid || "—"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => copyText(u.refId || "", "Referral ID copied!")}
                        className="cursor-pointer rounded-lg bg-[#fdf6e4] px-2.5 py-1 font-extrabold text-[#a9791c] transition-transform active:scale-95"
                        title="Click to copy"
                      >
                        {u.refId || "—"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap font-bold text-ink">+91 {u.phone}</td>
                    <td className="font-semibold text-[#7d6a6e]">{u.refBy || "—"}</td>
                    <td className="font-bold text-[#16a34a]">{fmt0(u.rechargeBalance)}</td>
                    <td className="font-bold text-maroon-700">{fmt0(u.balance)}</td>
                    <td className="font-bold text-[#a9791c]">{fmt0(u.totalIncome)}</td>
                    <td className="whitespace-nowrap font-medium text-[#7d6a6e]">
                      {fmtDate(u.createdAt)}
                    </td>
                    <td>
                      <Pill value={u.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {/* View details */}
                        <button
                          type="button"
                          aria-label="View user details"
                          onClick={() => openDetails(u)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-[#2563eb] transition-colors hover:bg-[#eef4ff]"
                          title="Bank, team tree, plans, recharges & withdrawals"
                        >
                          <Eye size={14} />
                        </button>
                        {/* Edit */}
                        <button
                          type="button"
                          aria-label="Edit user"
                          onClick={() => openEdit(u)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-maroon-700 transition-colors hover:bg-[#fbf1f3]"
                          title="Edit all details"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Ban / Unban */}
                        <button
                          type="button"
                          aria-label={u.status === "Banned" ? "Unban user" : "Ban user"}
                          onClick={() => toggleBan(u)}
                          className={`grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border transition-colors ${
                            u.status === "Banned"
                              ? "border-[#bbf7d0] bg-[#eafaf0] text-[#16a34a] hover:bg-[#d9f5e5]"
                              : "border-line-rose bg-white text-[#dc2626] hover:bg-[#fdecec]"
                          }`}
                          title={u.status === "Banned" ? "Unban" : "Ban"}
                        >
                          {u.status === "Banned" ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        </button>
                        {/* One-click login — direct session, admin only */}
                        <button
                          type="button"
                          aria-label="One click login"
                          onClick={() => oneClickLogin(u)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-[#a9791c] transition-colors hover:bg-[#fdf6e4]"
                          title="Login as this user — opens the app, valid 7 days"
                        >
                          <LogIn size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-[13.5px] font-medium text-muted-rose">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== EDIT USER MODAL ===== */}
      <Modal
        open={!!edit}
        wide
        title="Edit User"
        sub={edit ? "+91 " + edit.phone + (edit.name ? " · " + edit.name : "") : ""}
        onClose={() => setEdit(null)}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 font-display text-[14.5px] font-bold text-maroon-700">
            Profile Details
          </div>
          <Field label="Name">
            <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="User name" />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </Field>
          <Field label="User ID">
            <TextInput value={form.userid} onChange={(e) => set("userid", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Referral ID">
            <TextInput value={form.refId} onChange={(e) => set("refId", e.target.value.toUpperCase())} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Referred By" hint="Referrer's Referral ID (L1)">
              <TextInput value={form.refBy} onChange={(e) => set("refBy", e.target.value.toUpperCase())} placeholder="ZPXXXXXXXX" />
            </Field>
          </div>

          <div className="sm:col-span-2 mt-1 font-display text-[14.5px] font-bold text-maroon-700">
            Wallets
          </div>
          <Field label="Recharge Balance (₹)">
            <TextInput type="number" min="0" value={form.rechargeBalance} onChange={(e) => set("rechargeBalance", e.target.value)} />
          </Field>
          <Field label="Withdrawal Balance (₹)">
            <TextInput type="number" min="0" value={form.balance} onChange={(e) => set("balance", e.target.value)} />
          </Field>
          <Field label="Total Income (₹)">
            <TextInput type="number" min="0" value={form.totalIncome} onChange={(e) => set("totalIncome", e.target.value)} />
          </Field>
          <Field label="Account Status">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="Active">Active</option>
              <option value="Banned">Banned</option>
            </Select>
          </Field>

          <div className="sm:col-span-2 mt-1 font-display text-[14.5px] font-bold text-maroon-700">
            Security <span className="text-[11.5px] font-medium text-muted-rose">(blank = no change)</span>
          </div>
          <Field label="New Login Password">
            <TextInput type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 6 characters" />
          </Field>
          <Field label="New Withdraw Password">
            <TextInput type="text" value={form.withdrawPassword} onChange={(e) => set("withdrawPassword", e.target.value)} placeholder="Min 6 characters" />
          </Field>
        </div>
      </Modal>

      {/* ===== USER DETAILS DRAWER ===== */}
      <Modal
        open={!!viewUser}
        wide
        title="User Details"
        sub={
          viewUser
            ? "+91 " + viewUser.phone + (viewUser.name ? " · " + viewUser.name : "")
            : ""
        }
        onClose={() => {
          setViewUser(null);
          setDetails(null);
        }}
        footer={
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setViewUser(null);
              setDetails(null);
            }}
          >
            Close
          </button>
        }
      >
        {!details ? (
          <Loader label="Loading user details..." />
        ) : (
          <>
            {/* ===== STATS STRIP ===== */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {[
                { lbl: "Total Recharge", val: fmt0(details.stats.totalDeposit), cls: "text-[#16a34a]" },
                { lbl: "Total Withdraw", val: fmt0(details.stats.totalWithdraw), cls: "text-[#dc2626]" },
                { lbl: "Total Invested", val: fmt0(details.stats.totalInvest), cls: "text-maroon-700" },
                { lbl: "Team", val: String(details.stats.teamCount), cls: "text-[#a9791c]" },
                { lbl: "Active Plans", val: String(details.stats.activePlans), cls: "text-ink" },
              ].map((s) => (
                <div key={s.lbl} className="rounded-xl border border-line-rose bg-[#fdfafa] px-3 py-2.5 text-center">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-[#8a6e75]">
                    {s.lbl}
                  </div>
                  <div className={`mt-1 text-[15px] font-extrabold leading-none ${s.cls}`}>
                    {s.val}
                  </div>
                </div>
              ))}
            </div>

            {/* ===== PROFILE + WALLETS ===== */}
            <SectionTitle Icon={Users}>Profile &amp; Wallets</SectionTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <InfoRow k="Phone" v={"+91 " + details.user.phone} />
              <InfoRow k="User ID" v={details.user.userid} />
              <InfoRow k="Referral ID" v={details.user.refId} />
              <InfoRow k="Referred By (L1)" v={details.user.refBy} />
              <InfoRow k="Recharge Wallet" v={fmt0(details.user.rechargeBalance)} />
              <InfoRow k="Withdrawal Wallet" v={fmt0(details.user.balance)} />
              <InfoRow k="Total Income" v={fmt0(details.user.totalIncome)} />
              <InfoRow k="Joined" v={fmtD(details.user.createdAt)} />
            </div>

            {/* ===== BANK DETAILS ===== */}
            <SectionTitle Icon={Landmark}>Bank Details</SectionTitle>
            {details.bank && (details.bank.realName || details.bank.account) ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoRow k="Holder Name" v={details.bank.realName} />
                <InfoRow k="Bank Name" v={details.bank.bankName} />
                <InfoRow k="Account Number" v={details.bank.account} />
                <InfoRow k="IFSC Code" v={details.bank.ifsc} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
                No bank details saved yet — the bank card is saved automatically on the
                user&apos;s first withdrawal
              </div>
            )}

            {/* ===== REFERRAL TREE ===== */}
            <SectionTitle
              Icon={Network}
              right={
                <span className="rounded-full bg-[#f7e3e7] px-3 py-1 text-[11px] font-extrabold text-maroon-700">
                  {details.stats.teamCount} total
                </span>
              }
            >
              Referral Tree
            </SectionTitle>
            <div className="flex flex-col gap-4">
              <TeamBlock label="Level 1 (direct)" list={details.team.l1} />
              <TeamBlock label="Level 2" list={details.team.l2} />
              <TeamBlock label="Level 3" list={details.team.l3} />
            </div>

            {/* ===== PLANS PURCHASED ===== */}
            <SectionTitle Icon={TrendingUp}>Plans Purchased</SectionTitle>
            {details.invests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
                No plans purchased yet
              </div>
            ) : (
              <MiniTable head={["Plan", "Price", "Daily", "Cycle", "Paid", "Status", "Date"]}>
                {details.invests.map((i) => (
                  <tr key={i._id}>
                    <td className="font-bold text-ink">{i.planName}</td>
                    <td className="font-bold text-maroon-700">{fmt0(i.price)}</td>
                    <td className="font-bold text-[#16a34a]">{fmt0(i.daily)}</td>
                    <td className="font-semibold text-ink">{i.cycle} days</td>
                    <td className="font-semibold text-[#a9791c]">
                      {i.paidDays || 0}/{i.cycle}
                    </td>
                    <td><Pill value={i.status} /></td>
                    <td className="whitespace-nowrap text-[12px] text-[#7d6a6e]">
                      {fmtD(i.createdAt)}
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}

            {/* ===== RECHARGES ===== */}
            <SectionTitle Icon={ReceiptText}>Recharges</SectionTitle>
            {details.deposits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
                No recharges yet
              </div>
            ) : (
              <MiniTable head={["Amount", "Method", "Status", "Date"]}>
                {details.deposits.map((d) => (
                  <tr key={d._id}>
                    <td className="font-bold text-[#16a34a]">{fmt0(d.amount)}</td>
                    <td className="font-semibold text-ink">{d.method}</td>
                    <td><Pill value={d.status} /></td>
                    <td className="whitespace-nowrap text-[12px] text-[#7d6a6e]">
                      {fmtD(d.createdAt)}
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}

            {/* ===== WITHDRAWALS ===== */}
            <SectionTitle Icon={ReceiptText}>Withdrawals</SectionTitle>
            {details.withdrawals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
                No withdrawals yet
              </div>
            ) : (
              <MiniTable head={["Amount", "Bank", "Account", "Status", "Date"]}>
                {details.withdrawals.map((w) => (
                  <tr key={w._id}>
                    <td className="font-bold text-[#dc2626]">{fmt0(w.amount)}</td>
                    <td className="font-semibold text-ink">{w.bankName}</td>
                    <td className="font-mono text-[12px] text-[#7d6a6e]">
                      {String(w.account).replace(/\d(?=\d{4})/g, "•")}
                    </td>
                    <td><Pill value={w.status} /></td>
                    <td className="whitespace-nowrap text-[12px] text-[#7d6a6e]">
                      {fmtD(w.createdAt)}
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}
            {/* ===== WALLET LEDGER ===== */}
            <SectionTitle Icon={ReceiptText}>Wallet Ledger</SectionTitle>
            {details.transactions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-rose py-4 text-center text-[12.5px] font-semibold text-muted-rose">
                No wallet activity yet
              </div>
            ) : (
              <MiniTable head={["Type", "Details", "Amount", "Status", "Date"]}>
                {details.transactions.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                          t.type === "commission"
                            ? "bg-[#fdf6e4] text-[#a9791c]"
                            : t.type === "income"
                              ? "bg-[#eafaf0] text-[#16a34a]"
                              : t.type === "withdraw"
                                ? "bg-[#fdecec] text-[#dc2626]"
                                : "bg-[#eef4ff] text-[#2563eb]"
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="max-w-[260px] truncate font-semibold text-ink" title={t.title}>
                      {t.title || "—"}
                    </td>
                    <td
                      className={`font-bold ${
                        t.type === "withdraw" ? "text-[#dc2626]" : "text-[#16a34a]"
                      }`}
                    >
                      {t.type === "withdraw" ? "-" : "+"}
                      {fmt0(t.amount)}
                    </td>
                    <td><Pill value={t.status} /></td>
                    <td className="whitespace-nowrap text-[12px] text-[#7d6a6e]">
                      {fmtD(t.createdAt)}
                    </td>
                  </tr>
                ))}
              </MiniTable>
            )}
          </>
        )}
      </Modal>
    </AdminShell>
  );
}
