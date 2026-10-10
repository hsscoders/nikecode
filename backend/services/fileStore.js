/* ============================================================
   Local image storage — ImgBB REPLACED with on-server files
   ------------------------------------------------------------
   Uploads are written into backend/public/uploads and served by
   the same express.static that serves /banners. The returned URL
   is a local path (/uploads/<file>) which works on both origins
   through the /uploads/* rewrite proxy in both Next.js apps.

   Delete-sync: whenever an admin deletes/changes a banner, plan
   or QR image, deleteUpload() removes the old file from the disk
   so the storage never fills up with orphans.
============================================================ */
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");
const MAX_BYTES = 32 * 1024 * 1024; /* same cap as the old ImgBB proxy */

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/* local = served by this backend: /uploads/... (admin uploads) */
const isLocalUpload = (url) => /^\/uploads\//.test(String(url || "").split("?")[0]);

/* delete an uploaded file by its /uploads/<file> URL — safe (no traversal) */
function deleteUpload(url) {
  try {
    const u = String(url || "").split("?")[0];
    if (!u.startsWith("/uploads/")) return false;
    const file = path.basename(u);
    if (!/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith(".")) return false;
    const p = path.join(UPLOAD_DIR, file);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("🗑️  deleted upload:", file);
      return true;
    }
  } catch (e) {}
  return false;
}

/* magic-byte sniff — the client mime can lie, bytes cannot */
function sniffExt(buf) {
  if (!buf || buf.length < 12) return "";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP")
    return "webp";
  if (buf.slice(0, 3).toString("ascii") === "GIF") return "gif";
  return "";
}

/* save a base64 / data-URI image into public/uploads → /uploads/<file> */
function saveDataUrl(dataUri, nameHint) {
  let img = String(dataUri || "").trim();
  const m = img.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i);
  let mime = "image/png";
  let b64 = img;
  if (m) {
    mime = m[1].toLowerCase();
    b64 = m[2];
  }
  const buf = Buffer.from(b64, "base64");
  if (!buf.length) throw new Error("empty image data");
  if (buf.length > MAX_BYTES) throw new Error("image too large (max 32MB)");

  const ext = sniffExt(buf) || EXT_BY_TYPE[mime] || "png";
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const base =
    String(nameHint || "img")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "img";
  const file =
    base + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + "." + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  return { url: "/uploads/" + file, size: buf.length };
}

module.exports = { isLocalUpload, deleteUpload, saveDataUrl, UPLOAD_DIR, MAX_BYTES };
