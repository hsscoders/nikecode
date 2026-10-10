/* ============================================================
   ZAPTO THEME ENGINE — plain JS, NO imports/exports.
   SINGLE source of truth, loaded two ways:
   1. layout.jsx inlines this file into <head> — it runs during
      HTML parse, BEFORE the first paint, so a refresh never
      flashes the default maroon theme (FOUC fix).
   2. AppearanceProvider reuses it at runtime via window.ZaptoTheme
      (API refresh + realtime socket broadcasts).
   ============================================================ */
(function () {
  /* ============ COLOR HELPERS ============ */

  var clamp = function (n) { return Math.max(0, Math.min(255, Math.round(n))); };

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 124, g: 29, b: 51 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  var rgbToHex = function (c) {
    return "#" + [c.r, c.g, c.b].map(function (v) { return clamp(v).toString(16).padStart(2, "0"); }).join("");
  };

  /* t > 0 → toward white, t < 0 → toward black */
  function shade(hex, t) {
    var c = hexToRgb(hex);
    var m = function (v) { return t >= 0 ? v + (255 - v) * t : v * (1 + t); };
    return rgbToHex({ r: m(c.r), g: m(c.g), b: m(c.b) });
  }

  /* mix two colors — t = share of B */
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA);
    var b = hexToRgb(hexB);
    return rgbToHex({
      r: a.r + (b.r - a.r) * t,
      g: a.g + (b.g - a.g) * t,
      b: a.b + (b.b - a.b) * t,
    });
  }

  function rgbToHsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var l = (max + min) / 2;
    var h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var seg = Math.floor(h / 60) % 6;
    var t = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][seg];
    return rgbToHex({ r: (t[0] + m) * 255, g: (t[1] + m) * 255, b: (t[2] + m) * 255 });
  }

  /* ============ HAND-TUNED PRESET PALETTES ============
     Full palettes so every one-click theme looks professionally tuned.
     "maroon" holds the EXACT original design values — applying it restores
     the classic look pixel-for-pixel (fixes the washed-out default). */
  var PRESET_PALETTES = {
    maroon: {
      primary: "#7c1d33",
      primary2: "#93293f",
      primary3: "#a63b54",
      deep: "#6b1830",
      deep2: "#571224",
      deeper: "#42091a",
      accent: "#d4a94f",
      bg: "#faf6f7",
      tint: "#fbf1f3",
      tint2: "#f7e3e7",
      line: "#ecd6db",
      ink: "#3d2229",
      muted: "#a08a8f",
      icon: "#b27583",
      sbtn: "rgba(124,29,51,0.35)",
      salert: "rgba(66,9,26,0.4)",
    },
    royal: {
      primary: "#1e40af",
      primary2: "#2c50c5",
      primary3: "#4867cc",
      deep: "#1a3797",
      deep2: "#142c77",
      deeper: "#0f2058",
      accent: "#f0b429",
      bg: "#f7f8fb",
      tint: "#f0f3fc",
      tint2: "#e2e7f9",
      line: "#d4daed",
      ink: "#262c40",
      muted: "#898fa4",
      icon: "#7181b7",
      sbtn: "rgba(30,64,175,0.35)",
      salert: "rgba(15,32,88,0.4)",
    },
    emerald: {
      primary: "#0f6b4f",
      primary2: "#198464",
      primary3: "#269b78",
      deep: "#0d5c44",
      deep2: "#0a4936",
      deeper: "#083628",
      accent: "#d4af37",
      bg: "#f7fbf9",
      tint: "#f0fcf8",
      tint2: "#e1f9f2",
      line: "#d3eee6",
      ink: "#264038",
      muted: "#88a59c",
      icon: "#6fb9a2",
      sbtn: "rgba(15,107,79,0.35)",
      salert: "rgba(8,54,40,0.4)",
    },
    purple: {
      primary: "#4c1d95",
      primary2: "#5d2aac",
      primary3: "#6e39c0",
      deep: "#411980",
      deep2: "#341465",
      deeper: "#260f4b",
      accent: "#e9b949",
      bg: "#f8f7fa",
      tint: "#f5f1fb",
      tint2: "#ebe2f8",
      line: "#ded4ec",
      ink: "#30273f",
      muted: "#948aa3",
      icon: "#8d73b5",
      sbtn: "rgba(76,29,149,0.35)",
      salert: "rgba(38,15,75,0.4)",
    },
    ocean: {
      primary: "#0e7490",
      primary2: "#198aa9",
      primary3: "#279ebe",
      deep: "#0c647c",
      deep2: "#0a4f62",
      deeper: "#073a48",
      accent: "#f59e0b",
      bg: "#f6fafb",
      tint: "#effafd",
      tint2: "#e0f5fa",
      line: "#d2e9ef",
      ink: "#243b42",
      muted: "#879fa6",
      icon: "#6babbc",
      sbtn: "rgba(14,116,144,0.35)",
      salert: "rgba(7,58,72,0.4)",
    },
    rose: {
      primary: "#be185d",
      primary2: "#d4266e",
      primary3: "#d44983",
      deep: "#a31550",
      deep2: "#81103f",
      deeper: "#5f0c2f",
      accent: "#f0b429",
      bg: "#fbf7f8",
      tint: "#fcf0f5",
      tint2: "#fae1eb",
      line: "#eed3de",
      ink: "#412531",
      muted: "#a58894",
      icon: "#ba6e8d",
      sbtn: "rgba(190,24,93,0.35)",
      salert: "rgba(95,12,47,0.4)",
    },
    navy: {
      primary: "#111c3d",
      primary2: "#1c2a56",
      primary3: "#293a6c",
      deep: "#0f1834",
      deep2: "#0c1329",
      deeper: "#090e1f",
      accent: "#d4a94f",
      bg: "#f7f8fa",
      tint: "#f2f4fb",
      tint2: "#e4e9f6",
      line: "#d6dbea",
      ink: "#292e3d",
      muted: "#8c91a1",
      icon: "#7886b0",
      sbtn: "rgba(17,28,61,0.35)",
      salert: "rgba(9,14,31,0.4)",
    },
    sunset: {
      primary: "#c2410c",
      primary2: "#d95119",
      primary3: "#dd6838",
      deep: "#a7380a",
      deep2: "#842c08",
      deeper: "#612106",
      accent: "#fbbf24",
      bg: "#fbf8f6",
      tint: "#fdf3ef",
      tint2: "#fbe7df",
      line: "#f0dad1",
      ink: "#432c23",
      muted: "#a79086",
      icon: "#bf8268",
      sbtn: "rgba(194,65,12,0.35)",
      salert: "rgba(97,33,6,0.4)",
    },
    cherry: {
      primary: "#b91c1c",
      primary2: "#cf2a2a",
      primary3: "#d14c4c",
      deep: "#9f1818",
      deep2: "#7e1313",
      deeper: "#5d0e0e",
      accent: "#fbbf24",
      bg: "#fbf7f7",
      tint: "#fcf0f0",
      tint2: "#f9e1e1",
      line: "#edd3d3",
      ink: "#402626",
      muted: "#a48989",
      icon: "#b87070",
      sbtn: "rgba(185,28,28,0.35)",
      salert: "rgba(93,14,14,0.4)",
    },
    chocolate: {
      primary: "#6d4c41",
      primary2: "#815d51",
      primary3: "#946e62",
      deep: "#5e4138",
      deep2: "#4a342c",
      deeper: "#372621",
      accent: "#e0b973",
      bg: "#f9f8f8",
      tint: "#f8f5f4",
      tint2: "#f1ebe9",
      line: "#e5dedc",
      ink: "#38312e",
      muted: "#9b9492",
      icon: "#a08e87",
      sbtn: "rgba(109,76,65,0.35)",
      salert: "rgba(55,38,33,0.4)",
    },
    graphite: {
      primary: "#334155",
      primary2: "#435269",
      primary3: "#53647c",
      deep: "#2c3849",
      deep2: "#232c3a",
      deeper: "#1a212b",
      accent: "#38bdf8",
      bg: "#f8f9f9",
      tint: "#f4f6f8",
      tint2: "#e9ecf1",
      line: "#dce0e5",
      ink: "#2f3237",
      muted: "#92969b",
      icon: "#8892a0",
      sbtn: "rgba(51,65,85,0.35)",
      salert: "rgba(26,33,43,0.4)",
    },
    violet: {
      primary: "#6d28d9",
      primary2: "#834ed7",
      primary3: "#9971d7",
      deep: "#5e22bb",
      deep2: "#4a1b94",
      deeper: "#37146d",
      accent: "#f0abfc",
      bg: "#f8f7fa",
      tint: "#f5f0fc",
      tint2: "#ebe2f8",
      line: "#ded4ed",
      ink: "#30273f",
      muted: "#9489a4",
      icon: "#8c71b6",
      sbtn: "rgba(109,40,217,0.35)",
      salert: "rgba(55,20,109,0.4)",
    },
  };

  /* ============ WARM CUSTOM DERIVATION ============
     For custom brand colors — light tints are derived in HSL space so they
     keep the brand hue (the old white-mix made everything look washed out). */
  function deriveWarm(primary, accent) {
    var hsl = rgbToHsl(hexToRgb(primary));
    var h = hsl.h, sp = hsl.s, lp = hsl.l;
    var deeper = shade(primary, -0.5);
    var pRgb = hexToRgb(primary);
    var dRgb = hexToRgb(deeper);
    return {
      primary: primary,
      primary2: hslToHex(h, sp * 0.9, lp + 0.07),
      primary3: hslToHex(h, sp * 0.8, lp + 0.14),
      deep: shade(primary, -0.14),
      deep2: shade(primary, -0.32),
      deeper: deeper,
      accent: accent,
      bg: hslToHex(h, sp * 0.42, 0.975),
      tint: hslToHex(h, sp * 0.9, 0.965),
      tint2: hslToHex(h, sp * 0.9, 0.93),
      line: hslToHex(h, sp * 0.58, 0.88),
      ink: hslToHex(h, sp * 0.35, 0.2),
      muted: hslToHex(h, sp * 0.18, 0.59),
      icon: hslToHex(h, sp * 0.46, 0.58),
      sbtn: "rgba(" + pRgb.r + "," + pRgb.g + "," + pRgb.b + ",0.35)",
      salert: "rgba(" + dRgb.r + "," + dRgb.g + "," + dRgb.b + ",0.4)",
    };
  }

  /* Background tone overrides — applied on top of any palette */
  function applyBgTone(pal, tone) {
    if (!tone || tone === "warm") return pal;
    var hsl = rgbToHsl(hexToRgb(pal.primary));
    var h = hsl.h, sp = hsl.s;
    var out = Object.assign({}, pal);
    if (tone === "neutral") {
      out.bg = hslToHex(h, sp * 0.12, 0.975);
      out.tint = hslToHex(h, sp * 0.18, 0.965);
      out.tint2 = hslToHex(h, sp * 0.22, 0.935);
      out.line = hslToHex(h, sp * 0.22, 0.89);
    } else if (tone === "white") {
      out.bg = "#fdfcfd";
      out.tint = hslToHex(h, sp * 0.25, 0.985);
      out.tint2 = hslToHex(h, sp * 0.3, 0.965);
      out.line = hslToHex(h, sp * 0.3, 0.91);
    }
    return out;
  }

  /* ============ FONT OPTIONS (must match the Google Fonts link in layout) ============ */

  var HEAD_FONTS = {
    playfair: { name: "Playfair Display", css: "'Playfair Display', Georgia, serif" },
    poppins: { name: "Poppins", css: "'Poppins', Arial, sans-serif" },
    merriweather: { name: "Merriweather", css: "'Merriweather', Georgia, serif" },
    bebas: { name: "Bebas Neue", css: "'Bebas Neue', Impact, sans-serif" },
    dancingscript: { name: "Dancing Script", css: "'Dancing Script', cursive" },
    rubik: { name: "Rubik", css: "'Rubik', Arial, sans-serif" },
    oswald: { name: "Oswald", css: "'Oswald', 'Arial Narrow', sans-serif" },
    montserrat: { name: "Montserrat", css: "'Montserrat', Arial, sans-serif" },
    lora: { name: "Lora", css: "'Lora', Georgia, serif" },
    quicksand: { name: "Quicksand", css: "'Quicksand', Arial, sans-serif" },
    caveat: { name: "Caveat", css: "'Caveat', cursive" },
    josefin: { name: "Josefin Sans", css: "'Josefin Sans', Arial, sans-serif" },
  };

  var BODY_FONTS = {
    inter: { name: "Inter", css: "'Inter', Arial, sans-serif" },
    poppins: { name: "Poppins", css: "'Poppins', Arial, sans-serif" },
    nunito: { name: "Nunito", css: "'Nunito', Arial, sans-serif" },
    rubik: { name: "Rubik", css: "'Rubik', Arial, sans-serif" },
    dmsans: { name: "DM Sans", css: "'DM Sans', Arial, sans-serif" },
    roboto: { name: "Roboto", css: "'Roboto', Arial, sans-serif" },
    opensans: { name: "Open Sans", css: "'Open Sans', Arial, sans-serif" },
    lato: { name: "Lato", css: "'Lato', Arial, sans-serif" },
    mulish: { name: "Mulish", css: "'Mulish', Arial, sans-serif" },
    worksans: { name: "Work Sans", css: "'Work Sans', Arial, sans-serif" },
  };

  /* ============ THEME APPLIER ============
     Preset → exact hand-tuned palette. Custom → warm HSL derivation.
     bgTone overrides the page-surface tones. One call = whole site
     recolors instantly (see globals.css token mapping). */
  function applyTheme(a) {
    if (typeof window === "undefined" || !document.documentElement) return;
    var root = document.documentElement;
    var cfg = a || {};

    /* Resolve the base palette */
    var pal = PRESET_PALETTES[cfg.preset];
    if (!pal) {
      var ok = function (v, fb) {
        return /^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : fb;
      };
      pal = deriveWarm(ok(cfg.primary, "#7c1d33"), ok(cfg.accent, "#d4a94f"));
    }

    /* Readability guard — a very light primary would make white button
       text unreadable, so deepen the brand tone used across the site */
    var lp = rgbToHsl(hexToRgb(pal.primary)).l;
    if (lp > 0.6) {
      pal = deriveWarm(shade(pal.primary, -0.35), pal.accent);
    }

    pal = applyBgTone(pal, cfg.bgTone);

    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--c-primary", pal.primary);
    set("--c-primary2", pal.primary2);
    set("--c-primary3", pal.primary3);
    set("--c-deep", pal.deep);
    set("--c-deep2", pal.deep2);
    set("--c-deeper", pal.deeper);
    set("--c-accent", pal.accent);
    set("--c-bg", pal.bg);
    set("--c-tint", pal.tint);
    set("--c-tint2", pal.tint2);
    set("--c-line", pal.line);
    set("--c-ink", pal.ink);
    set("--c-muted", pal.muted);
    set("--c-icon", pal.icon);
    set("--s-btn", pal.sbtn);
    set("--s-alert", pal.salert);

    var head = HEAD_FONTS[cfg.fontHead] || HEAD_FONTS.playfair;
    var body = BODY_FONTS[cfg.fontBody] || BODY_FONTS.inter;
    set("--f-display", head.css);
    set("--f-body", body.css);
  }

  window.ZaptoTheme = {
    applyTheme: applyTheme,
    presets: PRESET_PALETTES,
    headFonts: HEAD_FONTS,
    bodyFonts: BODY_FONTS,
  };
})();
