"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Crown, Gem, Search, Upload } from "lucide-react";
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

export default function PlansPage() {
  const [plans, setPlans] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [del, setDel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl border border-line-rose bg-white px-3.5 py-2.5 sm:max-w-[340px]">
          <Search size={16} className="shrink-0 text-icon-rose" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium text-ink outline-none placeholder:text-[#c4a9b0]"
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

      {!plans ? (
        <Loader />
      ) : (
        <div className="admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Plan</th>
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
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-[42px] w-[42px] shrink-0 place-items-center overflow-hidden rounded-[13px] ${
                            p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[#f7e3e7] text-maroon-600"
                          }`}
                        >
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              width={42}
                              height={42}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : p.vip ? (
                            <Crown size={20} />
                          ) : (
                            <Gem size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-ink">{p.name}</div>
                          {p.presale && (
                            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.4px] text-[#a9791c]">
                              Pre Sale
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-bold text-maroon-700">{fmt0(p.price)}</td>
                    <td className="font-bold text-[#16a34a]">{fmt0(p.daily)}</td>
                    <td className="font-semibold text-ink">{p.cycle} Days</td>
                    <td className="font-bold text-[#a9791c]">{fmt0(p.total)}</td>
                    <td className="font-semibold text-ink">{p.limit > 0 ? p.limit : "∞"}</td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase ${
                          p.vip ? "bg-[#fdf6e4] text-[#a9791c]" : "bg-[#f7e3e7] text-maroon-700"
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
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-maroon-700 transition-colors hover:bg-[#fbf1f3]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete plan"
                          onClick={() => setDel(p)}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-[#dc2626] transition-colors hover:bg-[#fdecec]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[13.5px] font-medium text-muted-rose">
                      No plans found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border border-line-rose bg-white">
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
                    className={`grid h-[76px] w-[76px] shrink-0 place-items-center rounded-xl border border-dashed border-line-rose bg-[#fdf7f8] ${
                      form.vip ? "text-[#a9791c]" : "text-maroon-600"
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
          <div className="flex items-center justify-between rounded-xl border border-line-rose bg-[#fdfafa] px-4 py-3">
            <div className="text-[13.5px] font-bold text-ink">VIP Plan</div>
            <Switch checked={form.vip} onChange={(v) => set("vip", v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line-rose bg-[#fdfafa] px-4 py-3">
            <div className="text-[13.5px] font-bold text-ink">Pre Sale</div>
            <Switch checked={form.presale} onChange={(v) => set("presale", v)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line-rose bg-[#fdfafa] px-4 py-3 sm:col-span-2">
            <div>
              <div className="text-[13.5px] font-bold text-ink">Active</div>
              <div className="text-[11.5px] font-medium text-muted-rose">
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
