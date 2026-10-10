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

module.exports = router;
