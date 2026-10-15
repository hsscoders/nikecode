"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Crown, Gem, Search, Upload, Type, Save } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api, fmt0 } from "../../../lib/api";
import {
  Modal,
  Confirm,
  Switch,
  Field,
  TextInput,
  Loader,
  Toast,
  useToast,
} from "../../../components/ui";

const EMPTY = {
  name: "",
  vip: false,
  image: "",
  price: "",
  daily: "",
  cycle: "",
  total: "",
  limit: 0,
  presale: false,
  active: true,
  sort: 0,
};

/* Small labeled input for the compact Home Page Texts grid */
function MiniField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.4px] text-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-line bg-white px-2.5 py-2 text-[16px] font-semibold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-muted focus:border-brand-500 sm:py-[7px] sm:text-[13px]"
      />
    </label>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [texts, setTexts] = useState(null);
  const [savingTexts, setSavingTexts] = useState(false);
  const fileRef = useRef(null);
  const { toast, showToast, isError } = useToast();

  const load = async () => {
    try {
      const d = await api("/api/admin/plans");
      setPlans(d.plans);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    /* Home Page Texts — current tab labels + buy button texts */
    api("/api/admin/settings")
      .then((d) => {
        const h = d.settings && d.settings.homeTexts;
        if (h)
          setTexts({
            dailyTab: h.dailyTab || "",
            vipTab: h.vipTab || "",
            dailyBtn: h.dailyBtn || "",
            vipBtn: h.vipBtn || "",
          });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      vip: p.vip,
      image: p.image || "",
      price: p.price,
      daily: p.daily,
      cycle: p.cycle,
      total: p.total,
      limit: p.limit,
      presale: p.presale,
      active: p.active,
      sort: p.sort,
    });
    setModal(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* Plan image — stored on the server, auto-runs on file select */
  const uploadImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return showToast("Only image files are allowed (JPG/PNG/WebP/GIF)", true);
    if (file.size > 32 * 1024 * 1024) return showToast("Maximum image size is 32MB", true);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const d = await api("/api/admin/upload", {
          method: "POST",
          body: JSON.stringify({
            image: reader.result,
            name: file.name.replace(/\.[^.]+$/, ""),
          }),
        });
        set("image", d.url);
        showToast("Plan image uploaded successfully");
      } catch (e) {
        showToast(e.message, true);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setUploading(false);
      showToast("File read failed — please try again", true);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim()) return showToast("Enter plan name", true);
    if (!form.price || Number(form.price) <= 0) return showToast("Enter plan price", true);
    if (!form.daily || Number(form.daily) <= 0) return showToast("Enter daily income", true);
    if (!form.cycle || Number(form.cycle) <= 0) return showToast("Enter cycle days", true);
    if (!form.total || Number(form.total) <= 0) return showToast("Enter total return", true);
    setSaving(true);
    try {
      const body = {
        ...form,
        price: Number(form.price),
        daily: Number(form.daily),
        cycle: Number(form.cycle),
        total: Number(form.total),
        limit: Number(form.limit) || 0,
        sort: Number(form.sort) || 0,
      };
      if (editing) {
        await api("/api/admin/plans/" + editing._id, { method: "PUT", body: JSON.stringify(body) });
        showToast("Plan updated successfully");
      } else {
        await api("/api/admin/plans", { method: "POST", body: JSON.stringify(body) });
        showToast("Plan created successfully");
      }
      setModal(false);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      await api("/api/admin/plans/" + p._id, {
        method: "PUT",
        body: JSON.stringify({ active: !p.active }),
      });
      showToast(p.active ? "Plan deactivated" : "Plan activated");
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  /* Home Page Texts — /home plan tabs + buy buttons (client updates live) */
  const setText = (k, v) => setTexts((t) => ({ ...t, [k]: v }));

  const saveTexts = async () => {
    setSavingTexts(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ homeTexts: texts }),
      });
      showToast("Home page texts saved");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSavingTexts(false);
    }
  };

  const doDelete = async () => {
    try {
      await api("/api/admin/plans/" + del._id, { method: "DELETE" });
      showToast("Plan deleted");
      setDel(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const filtered = (plans || []).filter(
    (p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <AdminShell title="Manage Plans" sub="Home page plans — Daily & VIP, add / edit / activate">
      <Toast message={toast} isError={isError} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5 sm:max-w-[340px]">
          <Search size={16} className="shrink-0 text-icon" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium text-ink outline-none placeholder:text-muted sm:text-[13.5px]"
            placeholder="Search plans by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={openAdd}>
          <Plus size={16} />
          Add New Plan
        </button>
      </div>

      {/* Home Page Texts — compact editor for /home tab labels & buy buttons */}
      <div className="admin-card mb-4 p-3 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-tint2)]">
              <Type size={14} className="text-brand-700" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[14px] font-bold leading-tight text-ink">
                Home Page Texts
              </div>
              <div className="truncate text-[10.5px] font-medium text-muted">
                Tab labels &amp; buy buttons on /home
                <span className="hidden sm:inline"> — empty = default</span>
              </div>
            </div>
          </div>
          {texts && (
            <button
              type="button"
              onClick={saveTexts}
              disabled={savingTexts}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] brand-grad px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 sm:py-[7px]"
            >
              <Save size={13} />
              {savingTexts ? "Saving..." : "Save"}
            </button>
          )}
        </div>
        {!texts ? (
          <div className="py-1 text-[11.5px] font-medium text-muted">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <MiniField
              label="Daily Tab"
              value={texts.dailyTab}
              onChange={(v) => setText("dailyTab", v)}
              placeholder="Daily Plans"
            />
            <MiniField
              label="VIP Tab"
              value={texts.vipTab}
              onChange={(v) => setText("vipTab", v)}
              placeholder="Premium VIP"
            />
            <MiniField
              label="Daily Btn"
              value={texts.dailyBtn}
              onChange={(v) => setText("dailyBtn", v)}
              placeholder="Buy Now"
            />
            <MiniField
              label="VIP Btn"
              value={texts.vipBtn}
              onChange={(v) => setText("vipBtn", v)}
              placeholder="Buy Now"
            />
          </div>
        )}
      </div>

      {!plans ? (
        <Loader />
      ) : (
        <>
        {/* MOBILE — compact card list (table hidden below sm) */}
        <div className="flex flex-col gap-2.5 sm:hidden">
          {filtered.map((p) => (
            <div key={p._id} className="admin-card p-3">
              <div className="flex items-center gap-2.5">
                <div
                  title={p.name}
                  className={`grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[12px] ${
                    p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-600"
                  }`}
                >
                  {p.image ? (
                    <Image src={p.image} alt={p.name} width={46} height={46} unoptimized className="h-full w-full object-cover" />
                  ) : p.vip ? (
                    <Crown size={21} />
                  ) : (
                    <Gem size={21} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-extrabold leading-tight text-ink">{p.name}</div>
                  {p.presale && (
                    <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.4px] text-[#a9791c]">
                      Pre Sale
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase ${
                    p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-700"
                  }`}
                >
                  {p.vip ? "VIP" : "Daily"}
                </span>
              </div>

              <div className="mt-2.5 flex items-end justify-between gap-2">
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.5px] text-muted">Price</div>
                  <div className="mt-0.5 font-display text-[18px] font-extrabold leading-none text-brand-700">
                    {fmt0(p.price)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-bold text-[#475569]">{p.active ? "Active" : "Off"}</span>
                  <Switch checked={p.active} onChange={() => toggleActive(p)} />
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--color-tint)] p-2">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">Daily</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-[#16a34a]">{fmt0(p.daily)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">Cycle</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-ink">{p.cycle}d</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-muted">Return</div>
                  <div className="mt-0.5 text-[12.5px] font-extrabold text-[#a9791c]">{fmt0(p.total)}</div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2">
                <span className="text-[10.5px] font-semibold text-muted">
                  Limit: {p.limit > 0 ? p.limit + "/user" : "Unlimited"}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    aria-label="Edit plan"
                    onClick={() => openEdit(p)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-brand-700 transition-colors hover:bg-[var(--color-tint2)]"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label="Delete plan"
                    onClick={() => setDel(p)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-[#dc2626] transition-colors hover:bg-[#fdecec]"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="admin-card py-8 text-center text-[13px] font-medium text-muted">
              No plans found
            </div>
          )}
        </div>

        {/* DESKTOP — full table */}
        <div className="admin-card hidden overflow-hidden sm:block">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Plan image</th>
                  <th>Price</th>
                  <th>Daily Income</th>
                  <th>Cycle</th>
                  <th>Total Return</th>
                  <th>Limit</th>
                  <th>Type</th>
                  <th>Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          title={p.name}
                          className={`grid h-[48px] w-[48px] shrink-0 place-items-center overflow-hidden rounded-[13px] ${
                            p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-600"
                          }`}
                        >
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              width={48}
                              height={48}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : p.vip ? (
                            <Crown size={22} />
                          ) : (
                            <Gem size={22} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold leading-tight text-ink">{p.name}</div>
                          {p.presale && (
                            <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.4px] text-[#a9791c]">
                              Pre Sale
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-bold text-brand-700">{fmt0(p.price)}</td>
                    <td className="font-bold text-[#16a34a]">{fmt0(p.daily)}</td>
                    <td className="font-semibold text-ink">{p.cycle} Days</td>
                    <td className="font-bold text-[#a9791c]">{fmt0(p.total)}</td>
                    <td className="font-semibold text-ink">{p.limit > 0 ? p.limit : "∞"}</td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase ${
                          p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[var(--color-tint2)] text-brand-700"
                        }`}
                      >
                        {p.vip ? "VIP" : "Daily"}
                      </span>
                    </td>
                    <td>
                      <Switch checked={p.active} onChange={() => toggleActive(p)} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label="Edit plan"
                          onClick={() => openEdit(p)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line bg-white text-brand-700 transition-colors hover:bg-[var(--color-tint2)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete plan"
                          onClick={() => setDel(p)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line bg-white text-[#dc2626] transition-colors hover:bg-[#fdecec]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[13.5px] font-medium text-muted">
                      No plans found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* ADD / EDIT MODAL */}
      <Modal
        open={modal}
        title={editing ? "Edit Plan" : "Add New Plan"}
        sub={editing ? editing.name : "Plan will appear instantly on the client home page"}
        onClose={() => setModal(false)}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Plan" : "Create Plan"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Plan Name">
              <TextInput
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Starter Plan"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Plan Image"
              hint="Stored on the server — shown on the client home page plan card"
            >
              <div className="flex items-center gap-3">
                {form.image ? (
                  <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border border-line bg-white">
                    <Image
                      src={form.image}
                      alt="Plan image"
                      fill
                      unoptimized
                      sizes="76px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`grid h-[76px] w-[76px] shrink-0 place-items-center rounded-xl border border-dashed border-line bg-[var(--color-tint)] ${
                      form.vip ? "text-[#a9791c]" : "text-brand-600"
                    }`}
                  >
                    {form.vip ? <Crown size={26} strokeWidth={1.6} /> : <Gem size={26} strokeWidth={1.6} />}
                  </div>
                )}
                <div className="flex flex-1 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current && fileRef.current.click()}
                    disabled={uploading}
                    className="admin-btn admin-btn-ghost"
                  >
                    <Upload size={15} />
                    {uploading ? "Uploading..." : "Upload Image"}
                  </button>
                  {form.image && (
                    <button
                      type="button"
                      onClick={() => set("image", "")}
                      className="admin-btn admin-btn-danger"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImage(e.target.files && e.target.files[0])}
                />
              </div>
            </Field>
          </div>
          <Field label="Price (₹)">
            <TextInput type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="530" />
          </Field>
          <Field label="Daily Income (₹)">
            <TextInput type="number" min="0" value={form.daily} onChange={(e) => set("daily", e.target.value)} placeholder="63.6" />
          </Field>
          <Field label="Cycle (Days)">
            <TextInput type="number" min="1" value={form.cycle} onChange={(e) => set("cycle", e.target.value)} placeholder="10" />
          </Field>
          <Field label="Total Return (₹)">
            <TextInput type="number" min="0" value={form.total} onChange={(e) => set("total", e.target.value)} placeholder="636" />
          </Field>
          <Field label="Purchase Limit" hint="0 = unlimited">
            <TextInput type="number" min="0" value={form.limit} onChange={(e) => set("limit", e.target.value)} placeholder="1" />
          </Field>
          <Field label="Sort Order" hint="Lower numbers appear first">
            <TextInput type="number" value={form.sort} onChange={(e) => set("sort", e.target.value)} placeholder="0" />
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-line bg-[var(--color-tint)] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-[13.5px] font-bold text-ink">VIP Plan</div>
            <Switch checked={form.vip} onChange={(v) => set("vip", v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-[var(--color-tint)] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-[13.5px] font-bold text-ink">Pre Sale</div>
            <Switch checked={form.presale} onChange={(v) => set("presale", v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-[var(--color-tint)] px-3 py-2.5 sm:px-4 sm:py-3 sm:col-span-2">
            <div>
              <div className="text-[13.5px] font-bold text-ink">Active</div>
              <div className="text-[11.5px] font-medium text-muted">
                Inactive plans will not be visible on the client
              </div>
            </div>
            <Switch checked={form.active} onChange={(v) => set("active", v)} />
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Confirm
        open={!!del}
        danger
        title="Delete Plan"
        confirmLabel="Delete"
        message={`Plan "${del?.name}" will be permanently deleted. Are you sure?`}
        onCancel={() => setDel(null)}
        onConfirm={doDelete}
      />
    </AdminShell>
  );
}
