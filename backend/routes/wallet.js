const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { Op, sequelize, inc, dec } = require("../db");
const userAuth = require("../middleware/userAuth");
const { moneyRateLimit } = require("../middleware/rateLimit");
const User = require("../models/User");
const Invest = require("../models/Invest");
const Deposit = require("../models/Deposit");
const Withdrawal = require("../models/Withdrawal");
const Plan = require("../models/Plan");
const Setting = require("../models/Setting");
const Transaction = require("../models/Transaction");
const { emitToUser, emitAdmin } = require("../live");
const audit = require("../services/audit");

/* Absolute amount ceiling — a defensive cap in case the admin left
   maxAmount empty. Recharges beyond ₹1 crore are never legitimate. */
const ABS_MAX_AMOUNT = 10000000;

/* Ledger ref key — matches the string the historical rows were written
   with: pre-migration rows carry the old ObjectId, new rows the numeric id */
const refKeyOf = (row) => String(row.legacyId || row.id);

/* ============ WALLET SUMMARY (profile/home) ============ */
router.get("/wallet", userAuth, async (req, res) => {
  const u = req.user;
  res.json({
    success: true,
    wallet: {
      balance: u.balance,
      rechargeBalance: u.rechargeBalance,
      totalRecharge: u.totalRecharge || 0,
      totalIncome: u.totalIncome,
      userid: u.userid,
      refId: u.refId,
      phone: u.phone,
      name: u.name,
      status: u.status,
      bank: u.bank || null,
    },
  });
});

/* ============ DEPOSIT REQUEST (recharge page) ============ */
router.post("/deposit", userAuth, moneyRateLimit, async (req, res) => {
  try {
    const amount = Math.floor(Number(req.body && req.body.amount));
    /* method is a free string from the client — clamp its length so a
       oversized payload can never bloat the ledger documents */
    const method = String((req.body && req.body.method) || "Pay-T")
      .trim()
      .slice(0, 40);
    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid amount" });
    if (amount > ABS_MAX_AMOUNT)
      return res
        .status(400)
        .json({ success: false, message: "Amount too large" });

    /* Recharge limits — from the admin recharge setting (server-side validation) */
    const s = await Setting.getGlobal();
    const rc = (s && s.recharge) || {};
    const minR = Number(rc.minAmount) || 0;
    const maxR = Number(rc.maxAmount) || 0;
    if (minR && amount < minR)
      return res
        .status(400)
        .json({ success: false, message: "Minimum recharge is \u20B9" + minR });
    if (maxR && amount > maxR)
      return res
        .status(400)
        .json({ success: false, message: "Maximum recharge is \u20B9" + maxR });

    const deposit = await Deposit.create({
      user: req.user.id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      amount,
      method,
      status: "Pending",
    });

    /* ledger entry — the transaction history page reads these records */
    await Transaction.create({
      user: req.user.id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "recharge",
      title: "Recharge",
      method,
      amount,
      status: "Pending",
      refId: refKeyOf(deposit),
    });

    /* realtime — alert the admin panel instantly */
    emitAdmin("txns:new", {
      type: "recharge",
      phone: req.user.phone,
      amount,
      message: "New recharge request — \u20B9" + amount + " from " + req.user.phone,
    });
    /* pages push — /records, /transaction, /card show the request live */
    emitToUser(req.user.phone, "activity:update", { type: "recharge", status: "Pending" });

    audit.log(req, {
      actorType: "user",
      actor: { id: req.user.id, label: req.user.phone },
      action: "deposit.request",
      category: "deposit",
      target: refKeyOf(deposit),
      message: "Recharge request \u20B9" + amount + " via " + method,
      detail: { amount, method, status: "Pending" },
    });

    res.json({
      success: true,
      message: "Recharge request submitted!",
      deposit: {
        id: deposit.id,
        amount: deposit.amount,
        method: deposit.method,
        status: deposit.status,
      },
    });
  } catch (e) {
    console.error("deposit error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ INVEST (buy plan) ============ */
router.post("/invest", userAuth, moneyRateLimit, async (req, res) => {
  try {
    const planId = Number(req.body && req.body.planId);
    const plan = Number.isInteger(planId) && planId > 0 ? await Plan.findByPk(planId) : null;
    if (!plan || !plan.active)
      return res.status(400).json({ success: false, message: "Plan not available" });
    if (plan.presale)
      return res
        .status(400)
        .json({ success: false, message: "This plan is in pre-sale" });
    /* per-user purchase limit — count the user's ACTIVE holdings of this plan
       (re-buying is allowed again once a cycle completes) */
    if (plan.limit > 0) {
      const activeCount = await Invest.count({
        where: { user: req.user.id, planId: plan.id, status: "Active" },
      });
      if (activeCount >= plan.limit)
        return res.status(400).json({
          success: false,
          message:
            "Plan limit reached — you already hold the maximum active purchases of this plan",
        });
    }
    if (Number(req.user.rechargeBalance) < plan.price)
      return res.status(400).json({
        success: false,
        message: "Insufficient recharge balance. Please recharge first.",
      });

    /* atomic deduct — race safe (single guarded UPDATE, row-level atomic) */
    const [deducted] = await User.update(
      { rechargeBalance: dec("recharge_balance", plan.price) },
      { where: { id: req.user.id, rechargeBalance: { [Op.gte]: plan.price } } }
    );
    if (deducted === 0)
      return res.status(400).json({
        success: false,
        message: "Insufficient recharge balance. Please recharge first.",
      });

    /* money-safety — if the invest record fails AFTER the deduction, the
       balance is refunded immediately; the user never loses money to a DB hiccup */
    let invest;
    try {
      invest = await Invest.create({
        user: req.user.id,
        userid: req.user.userid || "",
        phone: req.user.phone,
        planId: plan.id,
        planName: plan.name,
        vip: plan.vip,
        price: plan.price,
        daily: plan.daily,
        cycle: plan.cycle,
        total: plan.total,
        status: "Active",
      });
    } catch (createErr) {
      await User.update(
        { rechargeBalance: inc("recharge_balance", plan.price) },
        { where: { id: req.user.id } }
      );
      throw createErr;
    }

    /* invite commission — L1/L2/L3 on the plan price (refBy = the referrer's refId) */
    try {
      const s = await Setting.getGlobal();
      const rates = (s && s.commission) || { level1: 25, level2: 3, level3: 2 };
      let refCode = req.user.refBy;
      let level = 1;
      while (refCode && level <= 3) {
        const ref = await User.findOne({ where: { refId: refCode } });
        if (!ref) break;
        const rate = rates["level" + level] || 0;
        const amt = +(((plan.price * rate) / 100).toFixed(2));
        if (amt > 0) {
          await User.update(
            { balance: inc("balance", amt) },
            { where: { id: ref.id } }
          );
          /* ledger entry — the referrer sees this in the transaction history */
          await Transaction.create({
            user: ref.id,
            userid: ref.userid || "",
            phone: ref.phone,
            type: "commission",
            title: "Team Commission",
            method: "Level " + level + " (" + rate + "%) — plan bought by " + req.user.phone,
            amount: amt,
            status: "Success",
          });
        }
        refCode = ref.refBy; /* next level up the chain */
        level++;
      }
    } catch (e) {
      console.error("commission error:", e.message);
    }

    /* ledger entry — "Buy Plan" shows in the transaction history */
    await Transaction.create({
      user: req.user.id,
      userid: req.user.userid || "",
      phone: req.user.phone,
      type: "invest",
      title: "Buy Plan",
      method: plan.name,
      amount: plan.price,
      status: "Success",
      refId: refKeyOf(invest),
    });

    /* realtime — push the new recharge balance to the buyer's other tabs */
    emitToUser(req.user.phone, "wallet:refresh", { reason: "invest" });
    /* pages push — /records shows the new plan instantly */
    emitToUser(req.user.phone, "activity:update", { type: "invest" });

    audit.log(req, {
      actorType: "user",
      actor: { id: req.user.id, label: req.user.phone },
      action: "invest.purchase",
      category: "invest",
      target: refKeyOf(invest),
      message: "Bought " + plan.name + " for \u20B9" + plan.price,
      detail: { planId: plan.id, planName: plan.name, price: plan.price, daily: plan.daily, cycle: plan.cycle },
    });

    res.json({
      success: true,
      message: "Plan purchased successfully!",
      order: {
        id: "ZP" + String(Date.now()).slice(-8),
        planId: plan.id,
        name: invest.planName,
        vip: !!invest.vip,
        price: invest.price,
        daily: invest.daily,
        cycle: invest.cycle,
        total: invest.total,
        boughtAt: invest.createdAt,
        status: "Active",
      },
      wallet: {
        balance: req.user.balance,
        rechargeBalance: +(Number(req.user.rechargeBalance) - plan.price).toFixed(2),
        totalIncome: req.user.totalIncome,
      },
    });
  } catch (e) {
    console.error("invest error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ WITHDRAW REQUEST ============ */
router.post("/withdraw", userAuth, moneyRateLimit, async (req, res) => {
  try {
    const { withdraw_password, bank } = req.body || {};
    const amount = Math.floor(Number(req.body && req.body.amount));
    if (amount > ABS_MAX_AMOUNT)
      return res
        .status(400)
        .json({ success: false, message: "Amount too large" });

    const s = await Setting.getGlobal();
    const wdCfg = (s && s.withdraw) || {};
    const minW = Number(wdCfg.minAmount) || (s && s.site && s.site.minWithdraw) || 130;
    const maxW = Number(wdCfg.maxAmount) || 0;
    /* withdrawal charge % — set from the admin panel, deducted from the request
       (?? 10 keeps the model default for pre-existing Setting docs without the field) */
    const chargePct = Math.min(100, Math.max(0, Number(wdCfg.chargePercent ?? 10)));
    const charge = Math.round(amount * chargePct) / 100;
    const netAmount = +(amount - charge).toFixed(2);

    /* master switch — one click in the admin panel stops ALL withdrawals */
    if (wdCfg.enabled === false)
      return res
        .status(403)
        .json({ success: false, message: "Withdrawals are temporarily stopped by the admin" });

    /* IST time window — requests allowed only between start & end time (overnight-safe) */
    const nowIst = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date()); // "HH:MM"
    const winStart = String(wdCfg.startTime || "00:00");
    const winEnd = String(wdCfg.endTime || "23:59");
    if (winStart !== winEnd) {
      const inWindow =
        winStart <= winEnd
          ? nowIst >= winStart && nowIst <= winEnd
          : nowIst >= winStart || nowIst <= winEnd;
      if (!inWindow)
        return res.status(403).json({
          success: false,
          message:
            "Withdrawals are open between " + winStart + " and " + winEnd + " (IST) only",
        });
    }

    /* daily limit — max withdrawal requests per user per day (IST calendar day) */
    const dailyLimit = Math.min(99, Math.max(0, Number(wdCfg.dailyLimit) || 0));
    if (dailyLimit > 0) {
      const todayIst = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date()); // "YYYY-MM-DD"
      const dayStartUtc = new Date(todayIst + "T00:00:00+05:30");
      const doneToday = await Withdrawal.count({
        where: { user: req.user.id, createdAt: { [Op.gte]: dayStartUtc } },
      });
      if (doneToday >= dailyLimit)
        return res.status(403).json({
          success: false,
          message: "Daily withdrawal limit reached (" + dailyLimit + " per day)",
        });
    }

    if (!amount || amount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Enter the withdrawal amount" });
    if (amount < minW)
      return res
        .status(400)
        .json({ success: false, message: "Minimum withdrawal is \u20B9" + minW });
    if (maxW && amount > maxW)
      return res
        .status(400)
        .json({ success: false, message: "Maximum withdrawal is \u20B9" + maxW });
    if (!bank || !bank.realName || !bank.account || !bank.ifsc || !bank.bankName)
      return res
        .status(400)
        .json({ success: false, message: "Bind your bank card first" });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(bank.ifsc || "").toUpperCase()))
      return res.status(400).json({ success: false, message: "IFSC code wrong" });
    if (!withdraw_password)
      return res
        .status(400)
        .json({ success: false, message: "Enter the withdrawal password" });

    const ok = await bcrypt.compare(String(withdraw_password), req.user.withdrawPassword);
    if (!ok)
      return res
        .status(400)
        .json({ success: false, message: "Incorrect withdrawal password" });

    if (Number(req.user.balance) < amount)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });

    /* atomic hold — single guarded UPDATE (row-level atomic) */
    const [held] = await User.update(
      { balance: dec("balance", amount) },
      { where: { id: req.user.id, balance: { [Op.gte]: amount } } }
    );
    if (held === 0)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient balance" });

    /* money-safety — if the withdrawal record / ledger fails AFTER the
       deduction, the balance is refunded immediately; the hold never silently
       eats the user's money on a DB hiccup */
    let wd;
    try {
      wd = await Withdrawal.create({
        user: req.user.id,
        userid: req.user.userid || "",
        phone: req.user.phone,
        amount,
        chargePercent: chargePct,
        charge,
        netAmount,
        /* same clamps as PUT /bank — the request body must never store
           longer strings than the dedicated card-saving endpoint allows */
        realName: String(bank.realName || "").trim().slice(0, 30),
        bankName: String(bank.bankName || "").trim().slice(0, 30),
        account: String(bank.account || "").trim().slice(0, 24),
        ifsc: String(bank.ifsc || "").trim().toUpperCase().slice(0, 11),
        status: "Pending",
      });

      /* save the bank card on the user (admin can view it in Manage Users) */
      await User.update(
        {
          bankRealName: String(bank.realName || "").trim().slice(0, 30),
          bankBankName: String(bank.bankName || "").trim().slice(0, 30),
          bankAccount: String(bank.account || "").trim().slice(0, 24),
          bankIfsc: String(bank.ifsc || "").trim().toUpperCase().slice(0, 11),
        },
        { where: { id: req.user.id } }
      );

      /* ledger entry — amount is the NET the user receives (after the charge),
         so /transaction shows ₹180 for a ₹200 request with a 10% fee */
      await Transaction.create({
        user: req.user.id,
        userid: req.user.userid || "",
        phone: req.user.phone,
        type: "withdraw",
        title: "Withdrawal",
        amount: netAmount,
        chargePercent: chargePct,
        charge,
        netAmount,
        status: "Pending",
        refId: refKeyOf(wd),
      });
    } catch (createErr) {
      await User.update(
        { balance: inc("balance", amount) },
        { where: { id: req.user.id } }
      );
      throw createErr;
    }

    /* realtime — alert the admin panel + sync the user's other tabs */
    emitAdmin("txns:new", {
      type: "withdraw",
      phone: req.user.phone,
      amount,
      netAmount,
      charge,
      message:
        "New withdrawal request — \u20B9" + amount + " (receive \u20B9" + netAmount + ") from " + req.user.phone,
    });
    emitToUser(req.user.phone, "wallet:refresh", { reason: "withdraw" });
    /* pages push — /records, /transaction, /withdrawal add the request live */
    emitToUser(req.user.phone, "activity:update", { type: "withdraw", status: "Pending" });

    audit.log(req, {
      actorType: "user",
      actor: { id: req.user.id, label: req.user.phone },
      action: "withdraw.request",
      category: "withdraw",
      target: refKeyOf(wd),
      message: "Withdrawal request \u20B9" + amount + " (net \u20B9" + netAmount + ") to " + bank.bankName,
      detail: { amount, charge, netAmount, chargePct, account: String(bank.account).slice(-4), ifsc: bank.ifsc },
    });

    res.json({
      success: true,
      message: "Withdrawal request submitted!",
      withdrawal: {
        id: wd.id,
        amount: wd.amount,
        chargePercent: chargePct,
        charge,
        netAmount,
        status: wd.status,
      },
      wallet: {
        balance: +(Number(req.user.balance) - amount).toFixed(2),
        rechargeBalance: req.user.rechargeBalance,
        totalIncome: req.user.totalIncome,
      },
    });
  } catch (e) {
    console.error("withdraw error:", e.message);
    res.status(500).json({ success: false, message: "Server error, please try again" });
  }
});

/* ============ BANK CARD — save the payout account from the /card page ============
   The card used to live only in the browser's localStorage, so it disappeared
   whenever that storage got cleared (or the user switched device). It is now
   saved on the user record server-side and restored from there. */
router.put("/bank", userAuth, moneyRateLimit, async (req, res) => {
  try {
    const { realName, ifsc, account, bankName } = req.body || {};
    const name = String(realName || "").trim().slice(0, 30);
    const code = String(ifsc || "").trim().toUpperCase();
    const acc = String(account || "").trim().slice(0, 24);
    const bank = String(bankName || "").trim().slice(0, 30);
    if (name.length < 3)
      return res
        .status(400)
        .json({ success: false, message: "Enter your real name" });
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code))
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid IFSC code" });
    if (!/\d{9,18}/.test(acc))
      return res
        .status(400)
        .json({ success: false, message: "Enter a valid bank account number" });
    if (!bank)
      return res
        .status(400)
        .json({ success: false, message: "Enter bank name" });

    await User.update(
      {
        bankRealName: name,
        bankBankName: bank,
        bankAccount: acc,
        bankIfsc: code,
      },
      { where: { id: req.user.id } }
    );
    audit.log(req, {
      actorType: "user",
      actor: { id: req.user.id, label: req.user.phone },
      action: "bank.save",
      category: "user",
      target: req.user.phone,
      message: "Bank card saved — " + bank + " (a/c ••" + acc.slice(-4) + ")",
      detail: { bankName: bank, ifsc: code, accountLast4: acc.slice(-4) },
    });
    res.json({
      success: true,
      message: "Bank card saved successfully!",
      bank: { realName: name, bankName: bank, account: acc, ifsc: code },
    });
  } catch (e) {
    console.error("bank save error:", e.message);
    res.status(500).json({ success: false, message: "Failed to save bank card" });
  }
});

/* ============ MY TEAM (invite/team page — REAL data) ============
   Walks the L1/L2/L3 referral chain of the logged-in user and returns
   per-member stats straight from the DB (recharge = the member's cumulative
   successful recharges, withdrawal = their successful payout total,
   refs = their own direct referral count). My commission comes from the
   ledger (type "commission") — the single source of truth. */
router.get("/team", userAuth, async (req, res) => {
  try {
    const TEAM_PROJ = ["id", "phone", "refId", "totalRecharge", "status", "createdAt"];
    const l1 = req.user.refId
      ? await User.findAll({
          where: { refBy: req.user.refId },
          attributes: TEAM_PROJ,
          order: [["createdAt", "DESC"]],
          limit: 100,
          raw: true,
        })
      : [];
    const l1Keys = l1.map((u) => u.refId).filter(Boolean);
    const l2 = l1Keys.length
      ? await User.findAll({
          where: { refBy: { [Op.in]: l1Keys } },
          attributes: TEAM_PROJ,
          order: [["createdAt", "DESC"]],
          limit: 100,
          raw: true,
        })
      : [];
    const l2Keys = l2.map((u) => u.refId).filter(Boolean);
    const l3 = l2Keys.length
      ? await User.findAll({
          where: { refBy: { [Op.in]: l2Keys } },
          attributes: TEAM_PROJ,
          order: [["createdAt", "DESC"]],
          limit: 100,
          raw: true,
        })
      : [];

    const all = [...l1, ...l2, ...l3];
    const allIds = all.map((m) => m.id);

    /* per-member successful withdrawal totals — one aggregate for everyone */
    const wdRows = allIds.length
      ? await sequelize.query(
          "SELECT user_id, SUM(amount) AS s FROM withdrawals WHERE status = 'Success' AND user_id IN (?) GROUP BY user_id",
          { replacements: [allIds], type: sequelize.QueryTypes.SELECT }
        )
      : [];
    const wdByUser = Object.fromEntries(wdRows.map((r) => [Number(r.user_id), Number(r.s)]));

    /* per-member referral counts (each member's own direct referrals) */
    const memberRefIds = all.map((m) => m.refId).filter(Boolean);
    const refRows = memberRefIds.length
      ? await sequelize.query(
          "SELECT ref_by, COUNT(*) AS c FROM users WHERE ref_by IN (?) GROUP BY ref_by",
          { replacements: [memberRefIds], type: sequelize.QueryTypes.SELECT }
        )
      : [];
    const refsByRefId = Object.fromEntries(refRows.map((r) => [r.ref_by, Number(r.c)]));

    /* my real team commission — the ledger is the truth */
    const commission = await Transaction.sum("amount", {
      where: { user: req.user.id, type: "commission" },
    });

    /* phones are masked server-side — the raw number never leaves the API */
    const shape = (list) =>
      list.map((m) => ({
        phone: String(m.phone || "").replace(/^(\d{3})\d{3}(\d{4})$/, "$1***$2"),
        date: m.createdAt,
        recharge: m.totalRecharge || 0,
        withdrawal: wdByUser[Number(m.id)] || 0,
        refs: refsByRefId[m.refId] || 0,
      }));

    const levels = { 1: shape(l1), 2: shape(l2), 3: shape(l3) };
    const teamRecharge = [1, 2, 3].reduce(
      (s, lv) => s + levels[lv].reduce((a, m) => a + Number(m.recharge || 0), 0),
      0
    );

    res.json({
      success: true,
      stats: {
        commission: Number(commission) || 0,
        recharge: teamRecharge,
        members: all.length,
      },
      levels,
    });
  } catch (e) {
    console.error("team error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load team" });
  }
});

/* ============ TRANSACTION HISTORY (ledger) ============ */
router.get("/invests", userAuth, async (req, res) => {
  try {
    const invests = await Invest.findAll({
      where: { user: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 200,
      raw: true,
    });
    res.json({
      success: true,
      invests: invests.map((iv) => ({
        id: "ZP" + String(iv.legacyId || iv.id).slice(-8),
        planId: iv.planId,
        name: iv.planName,
        vip: !!iv.vip,
        price: iv.price,
        daily: iv.daily,
        cycle: iv.cycle,
        total: iv.total,
        boughtAt: iv.createdAt,
        status: iv.status,
        paidDays: iv.paidDays || 0,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
});

router.get("/transactions", userAuth, async (req, res) => {
  try {
    const txns = await Transaction.findAll({
      where: { user: req.user.id },
      order: [["createdAt", "DESC"]],
      limit: 100,
      raw: true,
    });
    res.json({ success: true, txns });
  } catch (e) {
    console.error("transactions error:", e.message);
    res.status(500).json({ success: false, message: "Failed to load transactions" });
  }
});

module.exports = router;
