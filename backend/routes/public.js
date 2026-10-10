const router = require("express").Router();
const Plan = require("../models/Plan");
const Banner = require("../models/Banner");
const Setting = require("../models/Setting");

/* Banner image URLs absolute banao (client/admin dono origin se chale) */
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
        /* Local images relative path me jayein (/banners/...) — client/admin
           origin par rewrite proxy se serve hote hain (cross-device safe).
           ImgBB jaise full URLs as-is. */
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
      settings: s ? { commission: s.commission, site: s.site } : null,
    });
  } catch (e) {
    console.error("public settings error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load settings" });
  }
});

module.exports = router;
