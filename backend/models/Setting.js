const mongoose = require("mongoose");

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },
    commission: {
      level1: { type: Number, default: 25 },
      level2: { type: Number, default: 3 },
      level3: { type: Number, default: 2 },
    },
    site: {
      loginTitle: { type: String, default: "Login" },
      loginSubtitle: { type: String, default: "" },
      registerTitle: { type: String, default: "Register" },
      registerSubtitle: { type: String, default: "" },
      homeSubtitle: { type: String, default: "Earn daily, withdraw daily" },
      announcement: { type: String, default: "" },
      telegramUrl: { type: String, default: "" },
      downloadUrl: { type: String, default: "" },
      supportUrl: { type: String, default: "" },
      minRecharge: { type: Number, default: 530 },
      minWithdraw: { type: Number, default: 130 },
    },
    /* Home page welcome popup — fully controllable from the admin panel */
    popup: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: "Welcome to ZAPTO" },
      subtitle: { type: String, default: "Earn daily withdraw daily" },
      buttonText: { type: String, default: "Join Telegram Channel" },
      buttonUrl: { type: String, default: "" },
      bullets: [
        {
          _id: false,
          text: { type: String, default: "" },
          icon: { type: String, default: "check" },
        },
      ],
    },
    /* Recharge page (/recharge) — full control from the admin panel */
    recharge: {
      minAmount: { type: Number, default: 530 },
      maxAmount: { type: Number, default: 50000 },
      quickAmounts: { type: [Number], default: [600, 2200] },
      methods: [
        {
          _id: false,
          name: { type: String, default: "" },
          icon: { type: String, default: "wallet" },
          active: { type: Boolean, default: true },
        },
      ],
      manual: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: "Manual Payment" },
        upiId: { type: String, default: "" },
        accountName: { type: String, default: "" },
        qrImage: { type: String, default: "" },
        note: { type: String, default: "" },
      },
    },
    /* Withdrawal page (/withdrawal) — full control from the admin panel */
    withdraw: {
      minAmount: { type: Number, default: 130 },
      maxAmount: { type: Number, default: 50000 },
      /* withdrawal charge % — deducted from the requested amount, admin sets 0–100 */
      chargePercent: { type: Number, default: 10 },
      /* availability control — daily request limit, IST time window, master switch */
      dailyLimit: { type: Number, default: 0 }, // requests per user per day (0 = unlimited)
      startTime: { type: String, default: "00:00" }, // window start (IST, HH:MM)
      endTime: { type: String, default: "23:59" }, // window end (IST, HH:MM)
      enabled: { type: Boolean, default: true }, // master switch — false stops ALL withdrawals
      note: { type: String, default: "Withdrawals are processed within 24 hours" },
    },
    /* Daily plan income auto-credit — admin sets the time (IST, HH:MM) */
    income: {
      creditTime: { type: String, default: "00:00" },
      lastCreditDate: { type: String, default: "" }, // YYYY-MM-DD (IST) — prevents double credit
    },
    /* Look & feel — one-click color theme + font style for the whole client site.
       Presets carry a full hand-tuned palette on the client; custom colors are
       derived with warm HSL mixing (see applyTheme in AppearanceProvider).
       bgTone tunes the page background: warm (hue-tinted), neutral, white. */
    appearance: {
      preset: { type: String, default: "maroon" },
      primary: { type: String, default: "#7c1d33" },
      accent: { type: String, default: "#d4a94f" },
      fontHead: { type: String, default: "playfair" },
      fontBody: { type: String, default: "inter" },
      bgTone: { type: String, default: "warm" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", SettingSchema);

/* Whitelists shared by the admin settings route (attached after the model) */
const Setting = module.exports;
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
