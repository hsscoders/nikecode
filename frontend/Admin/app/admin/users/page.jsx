"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Pencil,
  Ban,
  ShieldCheck,
  LogIn,
  Copy,
  ExternalLink,
  Users,
  RefreshCw,
} from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0, fmtDate, CLIENT_URL } from "../../../lib/api";
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

export default function UsersPage() {
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [oneLogin, setOneLogin] = useState(null); // { link, phone }
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

  const oneClickLogin = async (u) => {
    try {
      const d = await api("/api/admin/users/" + u._id + "/onelogin", { method: "POST" });
      const link =
        CLIENT_URL + "/auto-login?token=" + encodeURIComponent(d.token) + "&phone=" + d.phone;
      setOneLogin({ link, phone: d.phone });
    } catch (e) {
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
                    <td className="font-bold text-ink">+91 {u.phone}</td>
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
                        {/* One-click login */}
                        <button
                          type="button"
                          aria-label="One click login"
                          onClick={() => oneClickLogin(u)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-[#a9791c] transition-colors hover:bg-[#fdf6e4]"
                          title="One-click login"
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

      {/* ===== ONE-CLICK LOGIN MODAL ===== */}
      <Modal
        open={!!oneLogin}
        title="One-Click Login"
        sub={oneLogin ? "+91 " + oneLogin.phone : ""}
        onClose={() => setOneLogin(null)}
        footer={
          <>
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => copyText(oneLogin.link, "Login link copied!")}
            >
              <Copy size={15} />
              Copy Link
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => window.open(oneLogin.link, "_blank")}
            >
              <ExternalLink size={15} />
              Open Client App
            </button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-[#7d6a6e]">
          With this link the user can log in directly to the app without a password. The link is valid for 7 days.
        </p>
        <div className="mt-3 break-all rounded-xl border border-line-rose bg-[#fbf1f3] px-4 py-3 font-mono text-[12px] font-medium text-maroon-800">
          {oneLogin?.link}
        </div>
      </Modal>
    </AdminShell>
  );
}
