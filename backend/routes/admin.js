const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const adminAuth = require("../middleware/adminAuth");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Banner = require("../models/Banner");
const Invest = require("../models/Invest");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const LoginCode = require("../models/LoginCode");
const { emitToUser, emitAdmin, emitAll } = require("../live");
const {
  isRemote,
  queueBannerCache,
  backfillBanners,
  BANNER_DIR,
} = require("../services/bannerCache");
const { isLocalUpload, deleteUpload, saveDataUrl } = require("../services/fileStore");
const fs = require("fs");
const path = require("path");

/* remove every local copy of a banner's own cached file (bnr-<id>.<ext>) */
const clearBannerFiles = (id) => {
  try {
    for (const f of fs.readdirSync(BANNER_DIR))
      if (f.startsWith("bnr-" + id + ".")) fs.unlinkSync(path.join(BANNER_DIR, f));
  } catch (e) {}
};

/* All admin routes protected */
router.use(adminAuth);

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const searchQuery = (raw, fields) => {
  const q = String(raw || "").trim();
  if (!q) return {};
  const rx = new RegExp(escapeRx(q), "i");
  return { $or: fields.map((f) => ({ [f]: rx })) };
};

/* Popup bullet icon keys — the client renders lucide icons by these names */
const VALID_BULLET_ICONS = ["trending", "users", "rupee", "card", "gift", "star", "zap", "check"];
/* Recharge method icon keys — used for the client icon mapping */
const VALID_METHOD_ICONS = ["smartphone", "landmark", "wallet", "credit-card", "rupee", "message"];

const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : Math.max(0, Math.round(n));
};

/* ==================================================
   DASHBOARD
================================================== */
router.get("/dashboard", async (req, res) => {
  try {
    /* IST day boundaries — "today" always means today in India */
    const todayIst = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());
    const dayStart = new Date(todayIst + "T00:00:00+05:30");

    const [totalUsers, totalPurchases, investAgg, wdAgg, dpAgg, recentInvests, recentWithdrawals, newUsers] =
      await Promise.all([
        User.countDocuments({}),
        Invest.countDocuments({}),
        Invest.aggregate([{ $group: { _id: null, amount: { $sum: "$price" } } }]),
        Withdrawal.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        ]),
        Deposit.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        ]),
        Invest.find().sort({ createdAt: -1 }).limit(6).lean(),
        Withdrawal.find().sort({ createdAt: -1 }).limit(6).lean(),
        User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } }),
      ]);

    /* 7-day registrations chart */
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);
    const regAgg = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]);
    const regMap = Object.fromEntries(regAgg.map((r) => [r._id, r.count]));
    const chart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      chart.push({
        day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        count: regMap[key] || 0,
      });
    }

    /* ===== ADVANCED ANALYTICS =====
       - today: today's business (IST) — recharge in, withdrawals out, new
         users, daily income paid, charge earned
       - wallets: total money sitting in user wallets
       - liability: daily payout the active plans owe every day
       - chargeEarned: charge collected from successful withdrawals (all time)
       - flow: 7-day money flow (successful deposits vs successful withdrawals)
       - topUsers: biggest investors by total plan value */
    const [todayRechargeAgg, todayWdAgg, todayUsers, todayIncomeAgg, walletAgg, activeAgg, chargeAgg, dpFlowAgg, wdFlowAgg, investTopAgg] =
      await Promise.all([
        Deposit.aggregate([
          { $match: { status: "Success", createdAt: { $gte: dayStart } } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]),
        Withdrawal.aggregate([
          { $match: { createdAt: { $gte: dayStart } } },
          { $group: { _id: null, amount: { $sum: "$amount" }, charge: { $sum: "$charge" } } },
        ]),
        User.countDocuments({ createdAt: { $gte: dayStart } }),
        Transaction.aggregate([
          { $match: { type: "income", createdAt: { $gte: dayStart } } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ]),
        User.aggregate([
          {
            $group: {
              _id: null,
              balance: { $sum: "$balance" },
              recharge: { $sum: "$rechargeBalance" },
              income: { $sum: "$totalIncome" },
            },
          },
        ]),
        Invest.aggregate([
          { $match: { status: "Active" } },
          { $group: { _id: null, daily: { $sum: "$daily" }, count: { $sum: 1 } } },
        ]),
        Withdrawal.aggregate([
          { $match: { status: "Success" } },
          { $group: { _id: null, charge: { $sum: "$charge" } } },
        ]),
        Deposit.aggregate([
          { $match: { status: "Success", createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: "$amount" } } },
        ]),
        Withdrawal.aggregate([
          { $match: { status: "Success", createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: "$amount" } } },
        ]),
        Invest.aggregate([
          { $group: { _id: "$phone", userid: { $first: "$userid" }, invested: { $sum: "$price" }, plans: { $sum: 1 } } },
          { $sort: { invested: -1 } },
          { $limit: 5 },
        ]),
      ]);

    /* 7-day money-flow chart — aligned with the registrations chart days */
    const dpMap = Object.fromEntries(dpFlowAgg.map((r) => [r._id, r.amount]));
    const wdMap = Object.fromEntries(wdFlowAgg.map((r) => [r._id, r.amount]));
    const flow = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      flow.push({
        day: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        deposit: dpMap[key] || 0,
        withdraw: wdMap[key] || 0,
      });
    }

    /* attach names to the top investors */
    const topPhones = investTopAgg.map((t) => t._id);
    const topUsersDocs = topPhones.length
      ? await User.find({ phone: { $in: topPhones } })
          .select("phone name userid")
          .lean()
      : [];
    const nameByPhone = Object.fromEntries(topUsersDocs.map((u) => [u.phone, u.name || ""]));
    const topUsers = investTopAgg.map((t) => ({
      phone: t._id,
      userid: t.userid || "",
      name: nameByPhone[t._id] || "",
      invested: t.invested,
      plans: t.plans,
    }));

    const byStatus = (agg) =>
      Object.fromEntries(agg.map((a) => [a._id, { count: a.count, amount: a.amount }]));
    const zero = { count: 0, amount: 0 };
    const w = walletAgg[0] || {};

    res.json({
      success: true,
      stats: {
        totalUsers,
        newUsers,
        totalPurchases,
        investedAmount: investAgg[0] ? investAgg[0].amount : 0,
        withdrawals: {
          Pending: byStatus(wdAgg).Pending || zero,
          Processing: byStatus(wdAgg).Processing || zero,
          Success: byStatus(wdAgg).Success || zero,
          Rejected: byStatus(wdAgg).Rejected || zero,
        },
        deposits: {
          Pending: byStatus(dpAgg).Pending || zero,
          Success: byStatus(dpAgg).Success || zero,
          Rejected: byStatus(dpAgg).Rejected || zero,
        },
        /* advanced */
        today: {
          recharge: todayRechargeAgg[0] ? todayRechargeAgg[0].amount : 0,
          withdrawals: todayWdAgg[0] ? todayWdAgg[0].amount : 0,
          charge: todayWdAgg[0] ? todayWdAgg[0].charge || 0 : 0,
          users: todayUsers,
          income: todayIncomeAgg[0] ? todayIncomeAgg[0].amount : 0,
        },
        wallets: {
          balance: w.balance || 0,
          recharge: w.recharge || 0,
          income: w.income || 0,
        },
        liability: {
          daily: activeAgg[0] ? activeAgg[0].daily : 0,
          activePlans: activeAgg[0] ? activeAgg[0].count : 0,
        },
        chargeEarned: chargeAgg[0] ? chargeAgg[0].charge || 0 : 0,
      },
      chart,
      flow,
      topUsers,
      recentInvests,
      recentWithdrawals,
    });
  } catch (e) {
    console.error("dashboard error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
});

/* ==================================================
   PLANS CRUD
================================================== */
router.get("/plans", async (req, res) => {
  const plans = await Plan.find({}).sort({ sort: 1, price: 1 }).lean();
  res.json({ success: true, plans });
});

router.post("/plans", async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.price || !b.daily || !b.cycle || !b.total)
      return res.status(400).json({ success: false, message: "Plan details missing" });
    const plan = await Plan.create({
      name: String(b.name).trim(),
      vip: !!b.vip,
      image: String(b.image || "").trim().slice(0, 500),
      price: Number(b.price),
      daily: Number(b.daily),
      cycle: Number(b.cycle),
      total: Number(b.total),
      limit: Number(b.limit) || 0,
      presale: !!b.presale,
      active: b.active === undefined ? true : !!b.active,
      sort: Number(b.sort) || 0,
    });
    emitAll("plans:update", { action: "create" });
    res.json({ success: true, message: "Plan created", plan });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to create plan" });
  }
});

router.put("/plans/:id", async (req, res) => {
  try {
    const b = req.body || {};
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    if (b.image !== undefined) {
      const next = String(b.image).trim().slice(0, 500);
      /* image changed — delete the old local file (delete-sync) */
      if (next !== plan.image && isLocalUpload(plan.image)) deleteUpload(plan.image);
      plan.image = next;
    }
    if (b.name !== undefined) plan.name = String(b.name).trim();
    if (b.vip !== undefined) plan.vip = !!b.vip;
    if (b.price !== undefined) plan.price = Number(b.price);
    if (b.daily !== undefined) plan.daily = Number(b.daily);
    if (b.cycle !== undefined) plan.cycle = Number(b.cycle);
    if (b.total !== undefined) plan.total = Number(b.total);
    if (b.limit !== undefined) plan.limit = Number(b.limit) || 0;
    if (b.presale !== undefined) plan.presale = !!b.presale;
    if (b.active !== undefined) plan.active = !!b.active;
    if (b.sort !== undefined) plan.sort = Number(b.sort) || 0;
    await plan.save();
    emitAll("plans:update", { action: "update" });
    res.json({ success: true, message: "Plan updated", plan });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update plan" });
  }
});

router.delete("/plans/:id", async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    /* delete-sync — remove the plan image file from the server too */
    deleteUpload(plan.image);
    emitAll("plans:update", { action: "delete" });
    res.json({ success: true, message: "Plan deleted", image: plan.image });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete plan" });
  }
});

/* ==================================================
   IMAGE UPLOAD — LOCAL STORAGE (ImgBB removed)
   body: { image: <base64 or data-URI>, name?: <filename> }
   return: { url: /uploads/<file> } — served by this backend,
   both Next apps reach it through the /uploads/* rewrite proxy.
   Deleting the banner/plan/QR that uses it removes the file too.
================================================== */
router.post("/upload", async (req, res) => {
  try {
    const img = String((req.body && req.body.image) || "").trim();
    if (!img)
      return res.status(400).json({ success: false, message: "Image required (base64 / data URI)" });
    if (img.length > 45_000_000)
      return res.status(400).json({ success: false, message: "Image too large (max ~32MB)" });

    const saved = saveDataUrl(img, req.body && req.body.name);
    res.json({
      success: true,
      message: "Image uploaded",
      url: saved.url,
      size: saved.size,
      local: true,
    });
  } catch (e) {
    console.error("upload error:", e.message);
    const msg = /too large/i.test(e.message)
      ? "Image too large (max 32MB)"
      : "Upload failed — invalid image data";
    res.status(500).json({ success: false, message: msg });
  }
});

/* ==================================================
   BANNERS CRUD
================================================== */
router.get("/banners", async (req, res) => {
  const banners = await Banner.find({}).sort({ sort: 1 }).lean();
  /* self-heal — localize banners still pointing at a remote host */
  backfillBanners(banners);
  res.json({ success: true, banners });
});

router.post("/banners", async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.image) return res.status(400).json({ success: false, message: "Banner image required" });
    const banner = await Banner.create({
      title: String(b.title || "").trim(),
      image: String(b.image).trim(),
      link: String(b.link || "").trim(),
      active: b.active === undefined ? true : !!b.active,
      sort: Number(b.sort) || 0,
    });
    /* permanent fix — download remote images to local storage so the
       client never depends on a slow host (optimizer 504s otherwise) */
    queueBannerCache(banner);
    emitAll("banners:update", { action: "create" });
    res.json({ success: true, message: "Banner created", banner });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to create banner" });
  }
});

router.put("/banners/:id", async (req, res) => {
  try {
    const b = req.body || {};
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    if (b.title !== undefined) banner.title = String(b.title).trim();
    if (b.image !== undefined) {
      const next = String(b.image).trim();
      const prev = banner.image;
      if (next !== prev) {
        /* image changed — the old file must not orphan on the disk */
        if (isLocalUpload(prev)) deleteUpload(prev);
        else clearBannerFiles(banner._id); /* previous bnr-<id> cached copy */
      }
      /* a brand-new remote URL → drop the old cache record so the
         downloader picks it up again */
      if (isRemote(next) && next !== banner.originUrl) banner.originUrl = "";
      banner.image = next;
    }
    if (b.link !== undefined) banner.link = String(b.link).trim();
    if (b.active !== undefined) banner.active = !!b.active;
    if (b.sort !== undefined) banner.sort = Number(b.sort) || 0;
    await banner.save();
    queueBannerCache(banner);
    emitAll("banners:update", { action: "update" });
    res.json({ success: true, message: "Banner updated", banner });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update banner" });
  }
});

router.delete("/banners/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    /* delete-sync — remove the file from the server too (cached copy
       and/or the admin-uploaded /uploads file) */
    clearBannerFiles(banner._id);
    deleteUpload(banner.image);
    emitAll("banners:update", { action: "delete" });
    res.json({ success: true, message: "Banner deleted", image: banner.image });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete banner" });
  }
});

/* ==================================================
   INVITE COMMISSION (L1/L2/L3)
================================================== */
router.get("/commission", async (req, res) => {
  const s = await Setting.findOne({ key: "global" }).lean();
  res.json({ success: true, commission: s ? s.commission : { level1: 25, level2: 3, level3: 2 } });
});

router.put("/commission", async (req, res) => {
  try {
    const b = req.body || {};
    const levels = ["level1", "level2", "level3"];
    for (const l of levels) {
      const v = Number(b[l]);
      if (isNaN(v) || v < 0 || v > 100)
        return res.status(400).json({ success: false, message: "Commission must be 0-100%" });
    }
    const s = await Setting.findOne({ key: "global" });
    s.commission = { level1: Number(b.level1), level2: Number(b.level2), level3: Number(b.level3) };
    await s.save();
    res.json({ success: true, message: "Commission settings saved", commission: s.commission });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to save commission" });
  }
});

/* ==================================================
   USERS
================================================== */
router.get("/users", async (req, res) => {
  try {
    const q = searchQuery(req.query.search, ["phone", "userid", "refId", "refBy", "name"]);
    const users = await User.find(q)
      .select("-password -withdrawPassword")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, users });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load users" });
  }
});

/* Full user profile — bank, referral tree (L1/L2/L3), plans, recharges, withdrawals, ledger */
router.get("/users/:id/details", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -withdrawPassword")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const TEAM_PROJ =
      "phone userid name refId refBy balance rechargeBalance totalIncome status createdAt";

    /* Level 1 — direct referrals, then walk down to L2 and L3 */
    const l1 = user.refId
      ? await User.find({ refBy: user.refId }).select(TEAM_PROJ).sort({ createdAt: -1 }).lean()
      : [];
    const l1Ids = l1.map((u) => u.refId).filter(Boolean);
    const l2 = l1Ids.length
      ? await User.find({ refBy: { $in: l1Ids } }).select(TEAM_PROJ).sort({ createdAt: -1 }).lean()
      : [];
    const l2Ids = l2.map((u) => u.refId).filter(Boolean);
    const l3 = l2Ids.length
      ? await User.find({ refBy: { $in: l2Ids } }).select(TEAM_PROJ).sort({ createdAt: -1 }).lean()
      : [];

    const [invests, deposits, withdrawals, transactions] = await Promise.all([
      Invest.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Deposit.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Withdrawal.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Transaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    /* quick money stats */
    const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const stats = {
      totalDeposit: sum(deposits.filter((d) => d.status === "Success"), (d) => d.amount),
      totalWithdraw: sum(
        withdrawals.filter((w) => w.status !== "Rejected"),
        (w) => w.amount
      ),
      totalInvest: sum(invests, (i) => i.price),
      teamCount: l1.length + l2.length + l3.length,
      activePlans: invests.filter((i) => i.status === "Active").length,
    };

    res.json({
      success: true,
      user,
      bank: user.bank || { realName: "", bankName: "", account: "", ifsc: "" },
      team: { l1, l2, l3 },
      invests,
      deposits,
      withdrawals,
      transactions,
      stats,
    });
  } catch (e) {
    console.error("user details error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load user details" });
  }
});

/* Edit all details — profile + wallets + passwords */
router.put("/users/:id", async (req, res) => {
  try {
    const b = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (b.phone !== undefined) {
      const p = String(b.phone).replace(/\D/g, "").replace(/^91/, "").replace(/^0/, "");
      if (!/^[6-9]\d{9}$/.test(p))
        return res.status(400).json({ success: false, message: "Invalid phone number" });
      user.phone = p;
    }
    if (b.name !== undefined) user.name = String(b.name).trim();
    if (b.userid !== undefined) user.userid = String(b.userid).trim();
    if (b.refId !== undefined) user.refId = String(b.refId).trim().toUpperCase();
    if (b.refBy !== undefined) user.refBy = String(b.refBy).trim().toUpperCase();
    if (b.balance !== undefined) user.balance = Number(b.balance) || 0;
    if (b.rechargeBalance !== undefined) user.rechargeBalance = Number(b.rechargeBalance) || 0;
    if (b.totalIncome !== undefined) user.totalIncome = Number(b.totalIncome) || 0;
    if (b.status !== undefined && ["Active", "Banned"].includes(b.status)) user.status = b.status;
    if (b.password) {
      if (String(b.password).length < 6)
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      user.password = await bcrypt.hash(String(b.password), 10);
    }
    if (b.withdrawPassword) {
      if (String(b.withdrawPassword).length < 6)
        return res.status(400).json({ success: false, message: "Withdraw password must be at least 6 characters" });
      user.withdrawPassword = await bcrypt.hash(String(b.withdrawPassword), 10);
    }
    await user.save();
    res.json({ success: true, message: "User updated" });
  } catch (e) {
    if (e.code === 11000)
      return res.status(400).json({ success: false, message: "Duplicate phone / userid / refId" });
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

/* Ban / Unban */
router.patch("/users/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["Active", "Banned"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("-password -withdrawPassword");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: status === "Banned" ? "User banned" : "User unbanned", user });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/* One-click login (admin only) — create a single-use code. The panel opens
   the client app with it directly; the app exchanges the code for a normal
   7-day session token. No link is shown or copied — click and you are in. */
router.post("/users/:id/onelogin", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    /* housekeeping — drop expired codes so the collection stays tiny */
    await LoginCode.deleteMany({ expiresAt: { $lt: new Date() } });

    const code = crypto.randomBytes(24).toString("hex");
    await LoginCode.create({
      code,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    res.json({ success: true, code, phone: user.phone, userid: user.userid });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to generate login" });
  }
});

/* ==================================================
   INVEST RECORDS
================================================== */
router.get("/invests", async (req, res) => {
  try {
    const q = searchQuery(req.query.search, ["phone", "userid", "planName"]);
    const invests = await Invest.find(q).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, invests });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load invests" });
  }
});

/* ==================================================
   DEPOSITS
================================================== */
router.get("/deposits", async (req, res) => {
  try {
    const filter = searchQuery(req.query.search, ["phone", "userid"]);
    if (req.query.status && ["Pending", "Success", "Rejected"].includes(req.query.status))
      filter.status = req.query.status;
    const deposits = await Deposit.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, deposits });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load deposits" });
  }
});

/* Manual deposit entry (admin credit) */
router.post("/deposits", async (req, res) => {
  try {
    const { userId, amount, method, status } = req.body || {};
    const amt = Number(amount);
    if (!userId) return res.status(400).json({ success: false, message: "Select a user" });
    if (!amt || amt <= 0) return res.status(400).json({ success: false, message: "Enter a valid amount" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const deposit = await Deposit.create({
      user: user._id,
      userid: user.userid || "",
      phone: user.phone,
      amount: amt,
      method: String(method || "Pay-T"),
      status: status === "Success" ? "Success" : "Pending",
      note: "Added by admin",
    });
    if (deposit.status === "Success")
      await User.updateOne(
        { _id: user._id },
        { $inc: { rechargeBalance: amt, totalRecharge: amt } }
      );

    /* realtime — the user's open tabs pick up the new recharge balance */
    emitToUser(user.phone, "wallet:refresh", { reason: "deposit", status: deposit.status });

    /* ledger entry */
    await Transaction.create({
      user: user._id,
      userid: user.userid || "",
      phone: user.phone,
      type: "recharge",
      title: "Recharge",
      method: deposit.method,
      amount: amt,
      status: deposit.status,
      refId: String(deposit._id),
    });

    res.json({ success: true, message: "Deposit added", deposit });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to add deposit" });
  }
});

/* Status change — credit the recharge balance on Success, debit on revoke */
router.put("/deposits/:id", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["Pending", "Success", "Rejected"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) return res.status(404).json({ success: false, message: "Deposit not found" });
    if (deposit.status === status)
      return res.json({ success: true, message: "No change", deposit });

    if (status === "Success" && deposit.status !== "Success")
      await User.updateOne(
        { _id: deposit.user },
        { $inc: { rechargeBalance: deposit.amount, totalRecharge: deposit.amount } }
      );
    if (status !== "Success" && deposit.status === "Success")
      await User.updateOne(
        { _id: deposit.user },
        { $inc: { rechargeBalance: -deposit.amount, totalRecharge: -deposit.amount } }
      );

    deposit.status = status;
    deposit.processedAt = new Date();
    await deposit.save();

    /* keep the ledger entry in sync */
    await Transaction.updateMany({ refId: String(deposit._id) }, { status });

    /* realtime — the user's open tabs pick up the new recharge balance */
    emitToUser(deposit.phone, "wallet:refresh", { reason: "deposit", status });
    /* pages push — /records, /transaction, /card reload their lists live */
    emitToUser(deposit.phone, "activity:update", { type: "recharge", status });

    res.json({ success: true, message: "Deposit " + status.toLowerCase(), deposit });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update deposit" });
  }
});

/* ==================================================
   WITHDRAWALS
================================================== */
router.get("/withdrawals", async (req, res) => {
  try {
    const filter = searchQuery(req.query.search, ["phone", "userid"]);
    if (req.query.status && ["Pending", "Processing", "Success", "Rejected"].includes(req.query.status))
      filter.status = req.query.status;
    const withdrawals = await Withdrawal.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, withdrawals });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load withdrawals" });
  }
});

/* Status change — refund the balance on Reject */
router.put("/withdrawals/:id", async (req, res) => {
  try {
    const { status, note } = req.body || {};
    if (!["Pending", "Processing", "Success", "Rejected"].includes(status))
      return res.status(400).json({ success: false, message: "Invalid status" });
    const wd = await Withdrawal.findById(req.params.id);
    if (!wd) return res.status(404).json({ success: false, message: "Withdrawal not found" });
    if (wd.status === status)
      return res.json({ success: true, message: "No change", withdrawal: wd });

    /* Reject → return the user's balance (refund from hold) */
    if (status === "Rejected" && wd.status !== "Rejected")
      await User.updateOne({ _id: wd.user }, { $inc: { balance: wd.amount } });
    /* Was Rejected and moved back to Processing/Success → revoke the refund */
    if (status !== "Rejected" && wd.status === "Rejected")
      await User.updateOne({ _id: wd.user }, { $inc: { balance: -wd.amount } });

    wd.status = status;
    if (note !== undefined) wd.note = String(note);
    wd.processedAt = new Date();
    await wd.save();

    /* keep the ledger entry in sync */
    await Transaction.updateMany({ refId: String(wd._id) }, { status });

    /* realtime — the user's open tabs pick up the refund / debit */
    emitToUser(wd.phone, "wallet:refresh", { reason: "withdraw", status });
    /* pages push — /records, /transaction, /withdrawal reload live */
    emitToUser(wd.phone, "activity:update", { type: "withdraw", status });

    res.json({ success: true, message: "Withdrawal " + status.toLowerCase(), withdrawal: wd });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to update withdrawal" });
  }
});

/* ==================================================
   SITE SETTINGS
================================================== */
router.get("/settings", async (req, res) => {
  const s = await Setting.findOne({ key: "global" }).lean();
  res.json({
    success: true,
    settings: s || { commission: {}, site: {} },
  });
});

router.put("/settings", async (req, res) => {
  try {
    const b = req.body || {};
    const s = await Setting.findOne({ key: "global" });
    if (!s) return res.status(404).json({ success: false, message: "Settings not found" });
    const siteFields = [
      "loginTitle",
      "loginSubtitle",
      "registerTitle",
      "registerSubtitle",
      "homeSubtitle",
      "announcement",
      "telegramUrl",
      "downloadUrl",
      "supportUrl",
    ];
    for (const f of siteFields) if (b.site && b.site[f] !== undefined) s.site[f] = String(b.site[f]);
    if (b.site && b.site.minRecharge !== undefined)
      s.site.minRecharge = Math.max(0, Number(b.site.minRecharge) || 0);
    if (b.site && b.site.minWithdraw !== undefined)
      s.site.minWithdraw = Math.max(0, Number(b.site.minWithdraw) || 0);

    /* Welcome popup (home page) — texts, bullets, enable/disable */
    if (b.popup) {
      const p = b.popup;
      if (p.enabled !== undefined) s.popup.enabled = !!p.enabled;
      if (p.title !== undefined) s.popup.title = String(p.title).trim().slice(0, 80);
      if (p.subtitle !== undefined) s.popup.subtitle = String(p.subtitle).trim().slice(0, 120);
      if (p.buttonText !== undefined) s.popup.buttonText = String(p.buttonText).trim().slice(0, 60);
      if (p.buttonUrl !== undefined) s.popup.buttonUrl = String(p.buttonUrl).trim().slice(0, 500);
      if (Array.isArray(p.bullets))
        s.popup.bullets = p.bullets
          .slice(0, 12)
          .filter((x) => x && String(x.text || "").trim())
          .map((x) => ({
            text: String(x.text).trim().slice(0, 120),
            icon: VALID_BULLET_ICONS.includes(x.icon) ? x.icon : "check",
          }));
    }

    /* Recharge settings — limits, quick amounts, methods, manual payment page */
    if (b.recharge) {
      const r = b.recharge;
      if (r.minAmount !== undefined) s.recharge.minAmount = num(r.minAmount);
      if (r.maxAmount !== undefined) s.recharge.maxAmount = num(r.maxAmount);
      if (Array.isArray(r.quickAmounts))
        s.recharge.quickAmounts = r.quickAmounts
          .map((q) => num(q))
          .filter((q) => q > 0 && q <= 100000000)
          .slice(0, 6);
      if (Array.isArray(r.methods))
        s.recharge.methods = r.methods
          .slice(0, 6)
          .filter((x) => x && String(x.name || "").trim())
          .map((x) => ({
            name: String(x.name).trim().slice(0, 30),
            icon: VALID_METHOD_ICONS.includes(x.icon) ? x.icon : "wallet",
            active: x.active === undefined ? true : !!x.active,
          }));
      if (r.manual) {
        const m = r.manual;
        if (m.enabled !== undefined) s.recharge.manual.enabled = !!m.enabled;
        if (m.title !== undefined) s.recharge.manual.title = String(m.title).trim().slice(0, 60);
        if (m.upiId !== undefined) s.recharge.manual.upiId = String(m.upiId).trim().slice(0, 120);
        if (m.accountName !== undefined)
          s.recharge.manual.accountName = String(m.accountName).trim().slice(0, 80);
        if (m.qrImage !== undefined) {
          const nextQr = String(m.qrImage).trim().slice(0, 500);
          /* QR changed — delete the old local file (delete-sync) */
          if (nextQr !== s.recharge.manual.qrImage && isLocalUpload(s.recharge.manual.qrImage))
            deleteUpload(s.recharge.manual.qrImage);
          s.recharge.manual.qrImage = nextQr;
        }
        if (m.note !== undefined) s.recharge.manual.note = String(m.note).trim().slice(0, 300);
      }
    }

    /* Withdrawal settings — limits + charge % + availability + note */
    if (b.withdraw) {
      const w = b.withdraw;
      if (w.minAmount !== undefined) s.withdraw.minAmount = num(w.minAmount);
      if (w.maxAmount !== undefined) s.withdraw.maxAmount = num(w.maxAmount);
      if (w.chargePercent !== undefined)
        s.withdraw.chargePercent = Math.min(100, Math.max(0, num(w.chargePercent)));
      if (w.dailyLimit !== undefined)
        s.withdraw.dailyLimit = Math.min(99, Math.max(0, num(w.dailyLimit)));
      if (w.startTime !== undefined && /^\d{2}:\d{2}$/.test(String(w.startTime)))
        s.withdraw.startTime = String(w.startTime);
      if (w.endTime !== undefined && /^\d{2}:\d{2}$/.test(String(w.endTime)))
        s.withdraw.endTime = String(w.endTime);
      if (w.enabled !== undefined) s.withdraw.enabled = !!w.enabled;
      if (w.note !== undefined) s.withdraw.note = String(w.note).trim().slice(0, 300);
    }

    /* Register bonus — signup credit switch + amount (₹, 0–100000).
       Credited server-side in the register API when enabled. */
    if (b.registerBonus) {
      const rb = b.registerBonus;
      if (rb.enabled !== undefined) s.registerBonus.enabled = !!rb.enabled;
      if (rb.amount !== undefined)
        s.registerBonus.amount = Math.min(
          100000,
          Math.max(0, num(rb.amount))
        );
    }

    /* Income time — daily plan income auto-credit time (IST, HH:MM) */
    if (b.income) {
      if (b.income.creditTime !== undefined) {
        const t = String(b.income.creditTime).trim();
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(t))
          return res
            .status(400)
            .json({ success: false, message: "Invalid time format — use HH:MM" });
        s.income.creditTime = t;
      }
    }

    /* Appearance (Font & Color) — one-click theme for the whole client site.
       Presets carry hand-tuned palettes on the client; only colors + font keys
       + background tone are stored here. Saving broadcasts the new theme to
       every connected user in realtime (socket appearance:changed). */
    let appearanceChanged = false;
    if (b.appearance) {
      if (!s.appearance) s.appearance = {};
      const a = b.appearance;
      const HEX = /^#[0-9a-fA-F]{6}$/;
      if (a.preset !== undefined) {
        s.appearance.preset = String(a.preset).trim().slice(0, 30);
        appearanceChanged = true;
      }
      if (a.primary !== undefined) {
        if (!HEX.test(String(a.primary).trim()))
          return res.status(400).json({ success: false, message: "Invalid primary color" });
        s.appearance.primary = String(a.primary).trim().toLowerCase();
        appearanceChanged = true;
      }
      if (a.accent !== undefined) {
        if (!HEX.test(String(a.accent).trim()))
          return res.status(400).json({ success: false, message: "Invalid accent color" });
        s.appearance.accent = String(a.accent).trim().toLowerCase();
        appearanceChanged = true;
      }
      if (a.fontHead !== undefined) {
        if (!Setting.HEAD_FONTS.includes(a.fontHead))
          return res.status(400).json({ success: false, message: "Invalid heading font" });
        s.appearance.fontHead = a.fontHead;
        appearanceChanged = true;
      }
      if (a.fontBody !== undefined) {
        if (!Setting.BODY_FONTS.includes(a.fontBody))
          return res.status(400).json({ success: false, message: "Invalid body font" });
        s.appearance.fontBody = a.fontBody;
        appearanceChanged = true;
      }
      if (a.bgTone !== undefined) {
        if (!Setting.BG_TONES.includes(a.bgTone))
          return res.status(400).json({ success: false, message: "Invalid background tone" });
        s.appearance.bgTone = a.bgTone;
        appearanceChanged = true;
      }
    }

    await s.save();
    /* Push the new look to every open client page instantly (no reload) */
    if (appearanceChanged) emitAll("appearance:changed", s.appearance);
    /* every settings save → client pages refetch (recharge UPI/QR, withdraw
       limits, popup text…) live without a manual refresh */
    emitAll("settings:update", { sections: Object.keys(b || {}) });
    res.json({ success: true, message: "Settings saved", settings: s });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to save settings" });
  }
});

module.exports = router;
