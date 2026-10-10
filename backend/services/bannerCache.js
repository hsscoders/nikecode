/* ============================================================
   Banner image local cache — PERMANENT FIX for slow remote hosts
   ------------------------------------------------------------
   Problem: admin banners use remote image hosts (e.g. ImgBB). The
   Next.js <Image> optimizer downloads remote images SERVER-SIDE and
   gives up after ~7s — big files (2MB+) over a slow upstream return
   504 forever, so new banners never render on /home.

   Fix: as soon as a banner is created/updated with a remote URL the
   backend downloads the file ONCE into backend/public/banners and
   rewrites banner.image to the local path (/banners/bnr-<id>.ext).
   Both client (:3000) and admin (:3001) serve that path through
   their /banners/* rewrite proxies → instant, cross-device safe and
   independent of the remote host afterwards.

   Self-heal: every banners list read (public + admin) queues any
   banner that still has a remote image for caching, so banners saved
   before this fix are localized automatically.
============================================================ */
const fs = require("fs");
const path = require("path");
const Banner = require("../models/Banner");

const BANNER_DIR = path.join(__dirname, "..", "public", "banners");
const MAX_BYTES = 32 * 1024 * 1024; /* same cap as the upload API */
const TIMEOUT_MS = 45 * 1000; /* generous — optimizer only allows ~7s */
const RETRIES = 4;
const RETRY_DELAY_MS = 20 * 1000;

/* ids currently queued/running — prevents duplicate downloads
   when the public + admin list endpoints fire together */
const inflight = new Set();

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const isRemote = (url) => /^https?:\/\//i.test(String(url || ""));

/* basic SSRF guard — banners are admin input, but stay safe anyway */
const isSafeHost = (hostname) =>
  !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?$)/i.test(hostname) &&
  !/^172\.(1[6-9]|2\d|3[01])\./.test(hostname) &&
  !/\.local$/i.test(hostname);

const extFromUrl = (url) => {
  const m = String(url).split("?")[0].match(/\.(png|jpe?g|webp|gif|avif)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "";
};

/* remove any previous local copy of this banner (ext may change) */
const clearLocalFiles = (id) => {
  try {
    for (const f of fs.readdirSync(BANNER_DIR))
      if (f.startsWith("bnr-" + id + ".")) fs.unlinkSync(path.join(BANNER_DIR, f));
  } catch (e) {}
};

/* download one banner image to backend/public/banners and localize it */
async function cacheBannerImage(banner) {
  const remote = String(banner.image || "");
  if (!isRemote(remote)) return false; /* already local — nothing to do */
  if (banner.originUrl && banner.originUrl === remote && !isRemote(banner.image))
    return true; /* already cached for this exact URL */

  const u = new URL(remote);
  if (!isSafeHost(u.hostname)) throw new Error("unsafe host blocked");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch(remote, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error("HTTP " + r.status);

  const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[type] || extFromUrl(remote) || "png";
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error("empty file");
  if (buf.length > MAX_BYTES) throw new Error("file too large");

  fs.mkdirSync(BANNER_DIR, { recursive: true });
  clearLocalFiles(banner._id); /* ext may change between updates */
  const file = "bnr-" + banner._id + "." + ext;
  fs.writeFileSync(path.join(BANNER_DIR, file), buf);

  banner.originUrl = remote;
  banner.image = "/banners/" + file;
  banner.markModified("image");
  await banner.save();
  console.log("✅ banner cached locally:", file, "(" + Math.round(buf.length / 1024) + " KB)");
  return true;
}

/* fire-and-forget queue with retries — list endpoints stay instant */
function queueBannerCache(banner, attempt = 1) {
  const id = String(banner._id);
  if (!isRemote(banner.image) || inflight.has(id)) return;
  inflight.add(id);
  (async () => {
    for (let i = attempt; i <= RETRIES; i++) {
      try {
        const fresh = await Banner.findById(id);
        if (!fresh || !isRemote(fresh.image)) break; /* deleted/localized meanwhile */
        await cacheBannerImage(fresh);
        break;
      } catch (e) {
        console.error("banner cache attempt " + i + "/" + RETRIES + " failed:", e.message);
        if (i < RETRIES) await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
      }
    }
    inflight.delete(id);
  })();
}

/* self-heal — queue every banner still pointing at a remote host */
function backfillBanners(docs) {
  docs.forEach((b) => {
    if (isRemote(b.image) && !b.originUrl) queueBannerCache(b);
  });
}

module.exports = { isRemote, cacheBannerImage, queueBannerCache, backfillBanners, BANNER_DIR };
