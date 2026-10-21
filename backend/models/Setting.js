const { sequelize, Sequelize } = require("../db");

/* ============================================================
   SETTINGS — was a Mongoose schema with per-field defaults.
   In MySQL the same document lives in a single JSON column and the
   model reproduces the Mongoose behaviour:

   - getGlobal()  → plain object, deep-merged over DEFAULTS, so a
     fresh/legacy settings row behaves exactly like the old schema
     defaults did (missing sections are filled in-memory).
   - saveGlobal(obj) → upserts the whole object.
   - The migration input gates (`if (b.qwackpay) { ... }`) and the
     field-level merges in admin.js keep working unchanged because
     getGlobal() returns a plain mutable object.
   ============================================================ */

const Setting = sequelize.define(
  "Setting",
  {
    key: { type: Sequelize.STRING(40), primaryKey: true, field: "key" },
    data: {
      type: Sequelize.JSON,
      /* MySQL 8 returns a parsed object; MariaDB stores JSON as
         LONGTEXT and returns a string — normalise both. */
      get() {
        const v = this.getDataValue("data");
        if (v == null) return {};
        return typeof v === "string" ? JSON.parse(v) : v;
      },
    },
  },
  { tableName: "settings", underscored: true }
);

/* ---- schema defaults carried over from the Mongoose model ---- */
Setting.DEFAULTS = {
  commission: { level1: 25, level2: 3, level3: 2 },
  site: {
    loginTitle: "Login",
    loginSubtitle: "",
    registerTitle: "Register",
    registerSubtitle: "",
    homeSubtitle: "Earn daily, withdraw daily",
    announcement: "",
    telegramUrl: "",
    downloadUrl: "",
    supportUrl: "",
    minRecharge: 530,
    minWithdraw: 130,
  },
  popup: {
    enabled: true,
    title: "Welcome to ZAPTO",
    subtitle: "Earn daily withdraw daily",
    buttonText: "Join Telegram Channel",
    buttonUrl: "",
    bullets: [],
  },
  homeTexts: {
    dailyTab: "Daily Plans",
    vipTab: "Premium VIP",
    dailyBtn: "Buy Now",
    vipBtn: "Buy Now",
  },
  recharge: {
    minAmount: 530,
    maxAmount: 50000,
    quickAmounts: [600, 2200],
    methods: [],
    manual: {
      enabled: true,
      title: "Manual Payment",
      upiId: "",
      accountName: "",
      qrImage: "",
      note: "",
    },
  },
  withdraw: {
    minAmount: 130,
    maxAmount: 50000,
    chargePercent: 10,
    dailyLimit: 0,
    startTime: "00:00",
    endTime: "23:59",
    enabled: true,
    note: "Withdrawals are processed within 24 hours",
  },
  registerBonus: { enabled: false, amount: 0 },
  income: { creditTime: "00:00", lastCreditDate: "" },
  qwackpay: {
    enabled: false,
    autoPayout: false,
    displayName: "QwackPay",
    merchantId: "",
    apiKey: "",
    baseUrl: "https://qwackpay.com/api/v1",
    backendUrl: "",
    clientUrl: "",
  },
  okpay: {
    enabled: false,
    autoPayout: false,
    displayName: "OKPay",
    mchId: "",
    apiKey: "",
    baseUrl: "https://api.wpay.one",
    backendUrl: "",
    clientUrl: "",
  },
  gatewayPrefs: { defaultPayoutGateway: "qwackpay" },
  publicUrls: { backendUrl: "", clientUrl: "" },
  appearance: {
    preset: "maroon",
    primary: "#7c1d33",
    accent: "#d4a94f",
    fontHead: "playfair",
    fontBody: "inter",
    bgTone: "warm",
  },
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function deepMerge(defaults, stored) {
  const out = Array.isArray(defaults) ? [...defaults] : { ...defaults };
  if (!isObj(stored)) return out;
  for (const k of Object.keys(stored)) {
    if (isObj(defaults && defaults[k]) && isObj(stored[k]))
      out[k] = deepMerge(defaults[k], stored[k]);
    else out[k] = stored[k];
  }
  return out;
}

/* the global settings object (plain, mutable — same shape as the old
   .lean() Mongoose document, with defaults filled in) */
Setting.getGlobal = async function () {
  const row = await Setting.findOne({ where: { key: "global" } });
  const stored = row ? row.get("data") : {};
  return deepMerge(Setting.DEFAULTS, stored || {});
};

Setting.saveGlobal = async function (obj) {
  await Setting.upsert({ key: "global", data: obj });
  return obj;
};

/* read-modify-write against the stored JSON (defaults NOT merged here —
   callers see the raw stored shape) */
Setting.patchGlobal = async function (fn) {
  const row = await Setting.findOne({ where: { key: "global" } });
  const data = row ? row.get("data") || {} : {};
  const next = fn(data) || data;
  await Setting.upsert({ key: "global", data: next });
  return next;
};

/* Whitelists shared by the admin settings route (carried over verbatim
   from the Mongoose model file) */
Setting.HEAD_FONTS = [
  "playfair",
  "poppins",
  "merriweather",
  "bebas",
  "dancingscript",
  "rubik",
  "oswald",
  "montserrat",
  "lora",
  "quicksand",
  "caveat",
  "josefin",
];
Setting.BODY_FONTS = [
  "inter",
  "poppins",
  "nunito",
  "rubik",
  "dmsans",
  "roboto",
  "opensans",
  "lato",
  "mulish",
  "worksans",
];
Setting.BG_TONES = ["warm", "neutral", "white"];

module.exports = Setting;
