/* ============================================================
   Safe external-URL opener.

   Several link fields (support URL, Telegram channel, welcome-popup
   button) are admin-configured strings. They must NEVER be passed to
   window.open unvalidated:
     - a "javascript:..." / "data:..." / "vbscript:..." value would
       execute script in the app's own origin (stored XSS), and
     - a plain "_blank" open lets the new page access window.opener
       (reverse tabnabbing → phishing on the original tab).

   isSafeUrl() accepts only absolute http/https URLs. safeOpen() opens
   them with noopener+noreferrer and returns false for anything else
   so callers can fall back to their "coming soon" toast.
   ============================================================ */

export function isSafeUrl(u) {
  try {
    const url = new URL(String(u || ""), window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (e) {
    return false;
  }
}

export function safeOpen(u) {
  if (typeof window === "undefined" || !isSafeUrl(u)) return false;
  window.open(String(u), "_blank", "noopener,noreferrer");
  return true;
}
