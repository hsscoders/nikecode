const router = require("express").Router();
const Plan = require("../models/Plan");
const Banner = require("../models/Banner");
const Setting = require("../models/Setting");

/* Make banner image URLs work from both client and admin origins */
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:3030";

/* ============ PUBLIC PLANS (client home) ============ */
router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ sort: 1, price: 1 }).lean();
    res.json({ success: true, plans });
  } catch (e) {
    console.error("public plans error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load plans" });
  }
});

/* ============ PUBLIC BANNERS (client home slider) ============ */
router.get("/banners", async (req, res) => {
  try {
    const banners = await Banner.find({ active: true }).sort({ sort: 1 }).lean();
    res.json({
      success: true,
      banners: banners.map((b) => ({
        _id: b._id,
        title: b.title,
        link: b.link,
        /* Local images keep a relative path (/banners/...) — they are served
           to the client/admin origins through the rewrite proxy (cross-device safe).
           Full URLs like ImgBB stay as-is. */
        image: b.image,
      })),
    });
  } catch (e) {
    console.error("public banners error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load banners" });
  }
});

/* ============ PUBLIC SETTINGS (client pages) ============ */
router.get("/settings", async (req, res) => {
  try {
    const s = await Setting.findOne({ key: "global" }).lean();
    res.json({
      success: true,
      settings: s
        ? {
            commission: s.commission,
            site: s.site,
            popup: s.popup || null,
            recharge: s.recharge || null,
            withdraw: s.withdraw || null,
            income: s.income ? { creditTime: s.income.creditTime } : null,
            appearance: s.appearance || null,
          }
        : null,
    });
  } catch (e) {
    console.error("public settings error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load settings" });
  }
});

/* ============ IFSC VERIFY (bank validation for /card) ============
   Real IFSC lookup via the public Razorpay IFSC API.
   - Wrong/unknown code  → { success:false, message:"IFSC code wrong" }
   - Valid code          → { success:true, bank:{bank, branch, city, state, ifsc} }
   - API unreachable     → { success:false, network:true } (client falls back to format check) */
const ifscCache = new Map(); /* code → lookup result (24h TTL) */

router.get("/ifsc/:code", async (req, res) => {
  const code = String(req.params.code || "").toUpperCase().trim();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code))
    return res.json({ success: false, message: "IFSC code wrong" });

  const cached = ifscCache.get(code);
  if (cached && Date.now() - cached.at < 864e5)
    return res.json({ success: true, bank: cached.data });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch("https://ifsc.razorpay.com/" + code, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok)
      return res.json({ success: false, message: "IFSC code wrong" }); /* 404 = not a real IFSC */
    const d = await r.json();
    const bank = {
      bank: d.BANK || "",
      branch: d.BRANCH || "",
      city: d.CITY || "",
      state: d.STATE || "",
      ifsc: d.IFSC || code,
    };
    ifscCache.set(code, { at: Date.now(), data: bank });
    res.json({ success: true, bank });
  } catch (e) {
    console.error("ifsc verify error:", e.message);
    res.json({ success: false, network: true, message: "IFSC service unavailable" });
  }
});

module.exports = router;
