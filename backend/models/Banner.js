const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    image: { type: String, required: true, trim: true },
    /* original remote URL kept when the image is cached locally
       (backend/public/banners) — lets us re-download and detect changes */
    originUrl: { type: String, default: "", trim: true },
    link: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", BannerSchema);
