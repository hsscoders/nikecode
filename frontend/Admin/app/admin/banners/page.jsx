"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, ImagePlus, Link2 } from "lucide-react";
import AdminShell from "../../../components/AdminShell";
import { api } from "../../../lib/api";
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

const EMPTY = { title: "", image: "", link: "", active: true, sort: 0 };

/* Local (/banners/...) paths are served via the same-origin rewrite proxy,
   full URLs like ImgBB as-is — both cross-device safe */
const bannerSrc = (img) => img;

export default function BannersPage() {
  const [banners, setBanners] = useState(null);
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
      const d = await api("/api/admin/banners");
      setBanners(d.banners);
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

  const openEdit = (b) => {
    setEditing(b);
    setForm({ title: b.title, image: b.image, link: b.link, active: b.active, sort: b.sort });
    setModal(true);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* ImgBB upload — auto-uploads on file select, fills the URL into the form */
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
        showToast("Image uploaded successfully");
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
    if (!form.image.trim()) return showToast("Upload an image or enter a URL", true);
    setSaving(true);
    try {
      const body = { ...form, sort: Number(form.sort) || 0 };
      if (editing) {
        await api("/api/admin/banners/" + editing._id, { method: "PUT", body: JSON.stringify(body) });
        showToast("Banner updated successfully");
      } else {
        await api("/api/admin/banners", { method: "POST", body: JSON.stringify(body) });
        showToast("Banner created successfully");
      }
      setModal(false);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b) => {
    try {
      await api("/api/admin/banners/" + b._id, {
        method: "PUT",
        body: JSON.stringify({ active: !b.active }),
      });
      showToast(b.active ? "Banner deactivated" : "Banner activated");
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const doDelete = async () => {
    try {
      await api("/api/admin/banners/" + del._id, { method: "DELETE" });
      showToast("Banner deleted");
      setDel(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  return (
    <AdminShell title="Home Banner Slider" sub="Client home slider — active banners rotate in order">
      <Toast message={toast} isError={isError} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-medium text-muted-rose">
          {banners ? `${banners.length} banner(s) total` : "Loading..."}
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={openAdd}>
          <Plus size={16} />
          Add New Banner
        </button>
      </div>

      {!banners ? (
        <Loader />
      ) : banners.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16">
          <div className="grid h-[64px] w-[64px] place-items-center rounded-[20px] bg-[#f7e3e7] text-maroon-600">
            <ImagePlus size={30} />
          </div>
          <div className="mt-4 font-display text-[17px] font-bold text-ink">No banners yet</div>
          <p className="mt-1 text-[13px] font-medium text-muted-rose">
            Add your first slider banner
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map((b) => (
            <div key={b._id} className="admin-card overflow-hidden">
              {/* PREVIEW */}
              <div className="relative h-[150px] bg-[#fbf1f3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerSrc(b.image)}
                  alt={b.title || "Banner"}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.opacity = 0;
                  }}
                />
                {!b.active && (
                  <div className="absolute inset-0 grid place-items-center bg-black/45">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.5px] text-maroon-800">
                      Inactive
                    </span>
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10.5px] font-extrabold text-white backdrop-blur">
                  #{b.sort || 0}
                </span>
              </div>

              {/* INFO */}
              <div className="p-4">
                <div className="truncate text-[14px] font-bold text-ink">
                  {b.title || "Untitled banner"}
                </div>
                <div className="mt-1 flex items-center gap-1.5 truncate text-[11.5px] font-medium text-muted-rose">
                  <Link2 size={12} className="shrink-0" />
                  {b.image}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line-rose/70 pt-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={b.active} onChange={() => toggleActive(b)} />
                    <span className="text-[12px] font-bold text-[#7d6a6e]">
                      {b.active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label="Edit banner"
                      onClick={() => openEdit(b)}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-maroon-700 transition-colors hover:bg-[#fbf1f3]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete banner"
                      onClick={() => setDel(b)}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] border border-line-rose bg-white text-[#dc2626] transition-colors hover:bg-[#fdecec]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      <Modal
        open={modal}
        title={editing ? "Edit Banner" : "Add New Banner"}
        onClose={() => setModal(false)}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Banner" : "Create Banner"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Banner Title">
            <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Diwali Offer" />
          </Field>
          <Field
            label="Banner Image"
            hint="Upload (JPG/PNG/WebP/GIF, max 32MB) or paste URL — 750x340 works best"
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadImage(e.target.files && e.target.files[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current && fileRef.current.click()}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-rose bg-[#fdfafa] px-4 py-6 text-[13px] font-bold text-maroon-700 transition-colors hover:bg-[#fbf1f3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-maroon-600 border-t-transparent" />
                  Uploading to ImgBB...
                </>
              ) : (
                <>
                  <ImagePlus size={18} />
                  Upload Image
                </>
              )}
            </button>
            <TextInput
              value={form.image}
              onChange={(e) => set("image", e.target.value)}
              placeholder="https://i.ibb.co/... or any image URL"
              className="mt-2"
            />
          </Field>
          {form.image && (
            <div className="h-[120px] overflow-hidden rounded-xl border border-line-rose bg-[#fbf1f3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bannerSrc(form.image)}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}
          <Field label="Click Link (optional)">
            <TextInput value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://t.me/yourchannel" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sort Order">
              <TextInput type="number" value={form.sort} onChange={(e) => set("sort", e.target.value)} placeholder="1" />
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-line-rose bg-[#fdfafa] px-4 py-3">
              <div className="text-[13.5px] font-bold text-ink">Active</div>
              <Switch checked={form.active} onChange={(v) => set("active", v)} />
            </div>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRM */}
      <Confirm
        open={!!del}
        danger
        title="Delete Banner"
        confirmLabel="Delete"
        message="This banner will be permanently removed from the slider. Are you sure?"
        onCancel={() => setDel(null)}
        onConfirm={doDelete}
      />
    </AdminShell>
  );
}
