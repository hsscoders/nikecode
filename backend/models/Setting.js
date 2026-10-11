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
    /* Home page plan tabs + buy buttons — texts editable from /admin/plans */
    homeTexts: {
      dailyTab: { type: String, default: "Daily Plans" },
      vipTab: { type: String, default: "Premium VIP" },
      dailyBtn: { type: String, default: "Buy Now" },
      vipBtn: { type: String, default: "Buy Now" },
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
    /* Register bonus — admin-controlled signup credit for every NEW user.
       Credited to rechargeBalance (plan-buy wallet) on successful register,
       with a "bonus" ledger entry in the transaction history. */
    registerBonus: {
      enabled: { type: Boolean, default: false }, // master switch — off = no bonus
      amount: { type: Number, default: 0 }, // ₹ credited on register (0 = no bonus)
    },
    /* Daily plan income auto-credit — admin sets the time (IST, HH:MM) */
    income: {
      creditTime: { type: String, default: "00:00" },
      lastCreditDate: { type: String, default: "" }, // YYYY-MM-DD (IST) — prevents double credit
    },
    /* QwackPay auto payment gateway (recharge + payout) — credentials are edited
       from Admin → Settings → Payment Gateway. The API key NEVER leaves the
       backend: the public settings route only exposes the `enabled` flag.
       displayName = the method label users see on the client /recharge page
       (admin can rename it there without touching the gateway itself). */
    qwackpay: {
      enabled: { type: Boolean, default: false }, // master switch — off hides the auto method
      autoPayout: { type: Boolean, default: false }, // allow one-click auto bank payouts from Admin → Withdrawals
      displayName: { type: String, default: "QwackPay" }, // label shown on the client recharge page
      merchantId: { type: String, default: "" }, // QwackPay merchant ID, e.g. 681551699
      apiKey: { type: String, default: "" }, // docking key from the merchant dashboard
      baseUrl: { type: String, default: "https://qwackpay.com/api/v1" },
      backendUrl: { type: String, default: "" }, // public backend origin — webhook notify_url
      clientUrl: { type: String, default: "" }, // public site origin — payment return_url
    },
    /* OKPay auto payment gateway (wpay.one) — recharge + payout. Credentials
       (mchId + key) come from the OKPay merchant dashboard and are edited in
       Admin → Settings → Payment Gateway. The key NEVER leaves the backend.
       backendUrl/clientUrl fall back to the QwackPay ones when left empty. */
    okpay: {
      enabled: { type: Boolean, default: false }, // master switch — off hides the auto method
      autoPayout: { type: Boolean, default: false }, // allow one-click auto bank payouts
      displayName: { type: String, default: "OKPay" }, // label shown on the client recharge page
      mchId: { type: String, default: "" }, // merchant id from the OKPay dashboard
      apiKey: { type: String, default: "" }, // private key from the OKPay dashboard
      baseUrl: { type: String, default: "https://api.wpay.one" },
      backendUrl: { type: String, default: "" }, // public backend origin — webhook notify_url
      clientUrl: { type: String, default: "" }, // public site origin — payment return_url
    },
    /* Cross-gateway preferences — shared by every automatic gateway (QwackPay
       today, more coming). defaultPayoutGateway preselects the gateway in the
       Admin → Withdrawals payout menu as more gateways are integrated. */
    gatewayPrefs: {
      defaultPayoutGateway: { type: String, default: "qwackpay" },
    },
    /* Public server URLs — auto-detected from the request domain the admin
       browses from and saved ONCE. EVERY gateway reuses them for the webhook
       notify_url and the payment return_url unless a per-gateway override is
       set (rare). No per-gateway URL typing as more gateways are added. */
    publicUrls: {
      backendUrl: { type: String, default: "" }, // e.g. https://domain.com — gateway callbacks
      clientUrl: { type: String, default: "" }, // e.g. https://domain.com — payment return
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
