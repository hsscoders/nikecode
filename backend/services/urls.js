/* ============ PUBLIC URL AUTO-DETECTION ============
   The gateway webhooks (notify_url) and the payment return_url need the
   PUBLIC origins of this server and the website. Instead of making the
   admin type them by hand, they are detected from the request that reaches
   this backend:

   Deployment shape (production):
     browser → nginx (https://domain.com) → Client :3000  (/api → :3030,
                                          → Admin  :3001  (/api → :3030))
   Every hop adds X-Forwarded-* headers, so the ORIGINAL public origin can
   be reconstructed here — exactly the URL the gateways must call back.

   Priority:
     host   = X-Forwarded-Host (first hop)   → Host header
     proto  = X-Forwarded-Proto (first hop)  → req.protocol (needs
                                               app.set("trust proxy", true))
     client = Origin / Referer of the browser request (the site the admin
              panel is opened on — same public domain in single-port deploys)

   The detected values are SUGGESTIONS: the admin can override them once in
   Admin → Payment Gateway → Server & Webhooks (settings.publicUrls) and
   every gateway reuses the saved pair automatically. */

function detectUrls(req) {
  const first = (v) => String(v || "").split(",")[0].trim();

  const fwdHost = first(req.headers && req.headers["x-forwarded-host"]);
  const fwdProto = first(req.headers && req.headers["x-forwarded-proto"]);
  const host = fwdHost || (req.get && req.get("host")) || "";
  const proto = fwdProto || req.protocol || "http";

  let backendUrl = "";
  if (host) {
    try {
      backendUrl = proto + "://" + host;
    } catch (e) {
      backendUrl = "";
    }
  }

  /* website origin — the admin panel runs on the same public site, so the
     browser Origin (fallback: Referer) IS the website public origin */
  let clientUrl = "";
  const orig = String(
    (req.headers && (req.headers.origin || req.headers.referer)) || ""
  ).trim();
  if (orig) {
    try {
      clientUrl = new URL(orig).origin;
    } catch (e) {
      clientUrl = "";
    }
  }

  return { backendUrl, clientUrl };
}

module.exports = { detectUrls };
