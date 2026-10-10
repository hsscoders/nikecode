"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Palette,
  Save,
  Info,
  RotateCcw,
  Check,
  Type,
  AlertTriangle,
  Zap,
} from "lucide-react";
import AdminShell from "../../../../components/AdminShell";
import { api } from "../../../../lib/api";
import { Loader, Toast, useToast } from "../../../../components/ui";

/* ============ ONE-CLICK PRESETS (mirror of the client PRESET_PALETTES) ============ */
const PRESETS = [
  { key: "maroon", name: "Maroon Gold", primary: "#7c1d33", accent: "#d4a94f" },
  { key: "royal", name: "Royal Blue", primary: "#1e40af", accent: "#f0b429" },
  { key: "emerald", name: "Emerald", primary: "#0f6b4f", accent: "#d4af37" },
  { key: "purple", name: "Royal Purple", primary: "#4c1d95", accent: "#e9b949" },
  { key: "ocean", name: "Ocean Teal", primary: "#0e7490", accent: "#f59e0b" },
  { key: "rose", name: "Rose Pink", primary: "#be185d", accent: "#f0b429" },
  { key: "navy", name: "Midnight Navy", primary: "#111c3d", accent: "#d4a94f" },
  { key: "sunset", name: "Sunset Orange", primary: "#c2410c", accent: "#fbbf24" },
  { key: "cherry", name: "Cherry Red", primary: "#b91c1c", accent: "#fbbf24" },
  { key: "chocolate", name: "Chocolate", primary: "#6d4c41", accent: "#e0b973" },
  { key: "graphite", name: "Graphite Steel", primary: "#334155", accent: "#38bdf8" },
  { key: "violet", name: "Royal Violet", primary: "#6d28d9", accent: "#f0abfc" },
];

/* Full hand-tuned palettes — same literals as the client applies */
const PALETTES = {
  maroon: {
    primary: "#7c1d33", primary2: "#93293f", primary3: "#a63b54",
    deep: "#6b1830", deep2: "#571224", deeper: "#42091a", accent: "#d4a94f",
    bg: "#faf6f7", tint: "#fbf1f3", tint2: "#f7e3e7", line: "#ecd6db",
    ink: "#3d2229", muted: "#a08a8f", icon: "#b27583",
    sbtn: "rgba(124,29,51,0.35)", salert: "rgba(66,9,26,0.4)",
  },
  royal: {
    primary: "#1e40af", primary2: "#2c50c5", primary3: "#4867cc",
    deep: "#1a3797", deep2: "#142c77", deeper: "#0f2058", accent: "#f0b429",
    bg: "#f7f8fb", tint: "#f0f3fc", tint2: "#e2e7f9", line: "#d4daed",
    ink: "#262c40", muted: "#898fa4", icon: "#7181b7",
    sbtn: "rgba(30,64,175,0.35)", salert: "rgba(15,32,88,0.4)",
  },
  emerald: {
    primary: "#0f6b4f", primary2: "#198464", primary3: "#269b78",
    deep: "#0d5c44", deep2: "#0a4936", deeper: "#083628", accent: "#d4af37",
    bg: "#f7fbf9", tint: "#f0fcf8", tint2: "#e1f9f2", line: "#d3eee6",
    ink: "#264038", muted: "#88a59c", icon: "#6fb9a2",
    sbtn: "rgba(15,107,79,0.35)", salert: "rgba(8,54,40,0.4)",
  },
  purple: {
    primary: "#4c1d95", primary2: "#5d2aac", primary3: "#6e39c0",
    deep: "#411980", deep2: "#341465", deeper: "#260f4b", accent: "#e9b949",
    bg: "#f8f7fa", tint: "#f5f1fb", tint2: "#ebe2f8", line: "#ded4ec",
    ink: "#30273f", muted: "#948aa3", icon: "#8d73b5",
    sbtn: "rgba(76,29,149,0.35)", salert: "rgba(38,15,75,0.4)",
  },
  ocean: {
    primary: "#0e7490", primary2: "#198aa9", primary3: "#279ebe",
    deep: "#0c647c", deep2: "#0a4f62", deeper: "#073a48", accent: "#f59e0b",
    bg: "#f6fafb", tint: "#effafd", tint2: "#e0f5fa", line: "#d2e9ef",
    ink: "#243b42", muted: "#879fa6", icon: "#6babbc",
    sbtn: "rgba(14,116,144,0.35)", salert: "rgba(7,58,72,0.4)",
  },
  rose: {
    primary: "#be185d", primary2: "#d4266e", primary3: "#d44983",
    deep: "#a31550", deep2: "#81103f", deeper: "#5f0c2f", accent: "#f0b429",
    bg: "#fbf7f8", tint: "#fcf0f5", tint2: "#fae1eb", line: "#eed3de",
    ink: "#412531", muted: "#a58894", icon: "#ba6e8d",
    sbtn: "rgba(190,24,93,0.35)", salert: "rgba(95,12,47,0.4)",
  },
  navy: {
    primary: "#111c3d", primary2: "#1c2a56", primary3: "#293a6c",
    deep: "#0f1834", deep2: "#0c1329", deeper: "#090e1f", accent: "#d4a94f",
    bg: "#f7f8fa", tint: "#f2f4fb", tint2: "#e4e9f6", line: "#d6dbea",
    ink: "#292e3d", muted: "#8c91a1", icon: "#7886b0",
    sbtn: "rgba(17,28,61,0.35)", salert: "rgba(9,14,31,0.4)",
  },
  sunset: {
    primary: "#c2410c", primary2: "#d95119", primary3: "#dd6838",
    deep: "#a7380a", deep2: "#842c08", deeper: "#612106", accent: "#fbbf24",
    bg: "#fbf8f6", tint: "#fdf3ef", tint2: "#fbe7df", line: "#f0dad1",
    ink: "#432c23", muted: "#a79086", icon: "#bf8268",
    sbtn: "rgba(194,65,12,0.35)", salert: "rgba(97,33,6,0.4)",
  },
  cherry: {
    primary: "#b91c1c", primary2: "#cf2a2a", primary3: "#d14c4c",
    deep: "#9f1818", deep2: "#7e1313", deeper: "#5d0e0e", accent: "#fbbf24",
    bg: "#fbf7f7", tint: "#fcf0f0", tint2: "#f9e1e1", line: "#edd3d3",
    ink: "#402626", muted: "#a48989", icon: "#b87070",
    sbtn: "rgba(185,28,28,0.35)", salert: "rgba(93,14,14,0.4)",
  },
  chocolate: {
    primary: "#6d4c41", primary2: "#815d51", primary3: "#946e62",
    deep: "#5e4138", deep2: "#4a342c", deeper: "#372621", accent: "#e0b973",
    bg: "#f9f8f8", tint: "#f8f5f4", tint2: "#f1ebe9", line: "#e5dedc",
    ink: "#38312e", muted: "#9b9492", icon: "#a08e87",
    sbtn: "rgba(109,76,65,0.35)", salert: "rgba(55,38,33,0.4)",
  },
  graphite: {
    primary: "#334155", primary2: "#435269", primary3: "#53647c",
    deep: "#2c3849", deep2: "#232c3a", deeper: "#1a212b", accent: "#38bdf8",
    bg: "#f8f9f9", tint: "#f4f6f8", tint2: "#e9ecf1", line: "#dce0e5",
    ink: "#2f3237", muted: "#92969b", icon: "#8892a0",
    sbtn: "rgba(51,65,85,0.35)", salert: "rgba(26,33,43,0.4)",
  },
  violet: {
    primary: "#6d28d9", primary2: "#834ed7", primary3: "#9971d7",
    deep: "#5e22bb", deep2: "#4a1b94", deeper: "#37146d", accent: "#f0abfc",
    bg: "#f8f7fa", tint: "#f5f0fc", tint2: "#ebe2f8", line: "#ded4ed",
    ink: "#30273f", muted: "#9489a4", icon: "#8c71b6",
    sbtn: "rgba(109,40,217,0.35)", salert: "rgba(55,20,109,0.4)",
  },
};

/* ============ FONT OPTIONS (loaded in both layouts) ============ */
const HEAD_FONTS = [
  { key: "playfair", name: "Playfair Display", css: "'Playfair Display', Georgia, serif" },
  { key: "poppins", name: "Poppins", css: "'Poppins', Arial, sans-serif" },
  { key: "merriweather", name: "Merriweather", css: "'Merriweather', Georgia, serif" },
  { key: "bebas", name: "Bebas Neue", css: "'Bebas Neue', Impact, sans-serif" },
  { key: "dancingscript", name: "Dancing Script", css: "'Dancing Script', cursive" },
  { key: "rubik", name: "Rubik", css: "'Rubik', Arial, sans-serif" },
  { key: "oswald", name: "Oswald", css: "'Oswald', 'Arial Narrow', sans-serif" },
  { key: "montserrat", name: "Montserrat", css: "'Montserrat', Arial, sans-serif" },
  { key: "lora", name: "Lora", css: "'Lora', Georgia, serif" },
  { key: "quicksand", name: "Quicksand", css: "'Quicksand', Arial, sans-serif" },
  { key: "caveat", name: "Caveat", css: "'Caveat', cursive" },
  { key: "josefin", name: "Josefin Sans", css: "'Josefin Sans', Arial, sans-serif" },
];
const BODY_FONTS = [
  { key: "inter", name: "Inter", css: "'Inter', Arial, sans-serif" },
  { key: "poppins", name: "Poppins", css: "'Poppins', Arial, sans-serif" },
  { key: "nunito", name: "Nunito", css: "'Nunito', Arial, sans-serif" },
  { key: "rubik", name: "Rubik", css: "'Rubik', Arial, sans-serif" },
  { key: "dmsans", name: "DM Sans", css: "'DM Sans', Arial, sans-serif" },
  { key: "roboto", name: "Roboto", css: "'Roboto', Arial, sans-serif" },
  { key: "opensans", name: "Open Sans", css: "'Open Sans', Arial, sans-serif" },
  { key: "lato", name: "Lato", css: "'Lato', Arial, sans-serif" },
  { key: "mulish", name: "Mulish", css: "'Mulish', Arial, sans-serif" },
  { key: "worksans", name: "Work Sans", css: "'Work Sans', Arial, sans-serif" },
];

/* ============ COLOR HELPERS (exact mirror of the client applier) ============ */
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 124, g: 29, b: 51 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
const rgbToHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
function shade(hex, t) {
  const { r, g, b } = hexToRgb(hex);
  const m = (v) => (t >= 0 ? v + (255 - v) * t : v * (1 + t));
  return rgbToHex({ r: m(r), g: m(g), b: m(b) });
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const t = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][seg];
  return rgbToHex({ r: (t[0] + m) * 255, g: (t[1] + m) * 255, b: (t[2] + m) * 255 });
}
/* Warm HSL derivation — keeps the brand hue in every tint (no white wash) */
function deriveWarm(primary, accent) {
  const { h, s: sp, l: lp } = rgbToHsl(hexToRgb(primary));
  const deeper = shade(primary, -0.5);
  const pRgb = hexToRgb(primary);
  const dRgb = hexToRgb(deeper);
  return {
    primary,
    primary2: hslToHex(h, sp * 0.9, lp + 0.07),
    primary3: hslToHex(h, sp * 0.8, lp + 0.14),
    deep: shade(primary, -0.14),
    deep2: shade(primary, -0.32),
    deeper,
    accent,
    bg: hslToHex(h, sp * 0.42, 0.975),
    tint: hslToHex(h, sp * 0.9, 0.965),
    tint2: hslToHex(h, sp * 0.9, 0.93),
    line: hslToHex(h, sp * 0.58, 0.88),
    ink: hslToHex(h, sp * 0.35, 0.2),
    muted: hslToHex(h, sp * 0.18, 0.59),
    icon: hslToHex(h, sp * 0.46, 0.58),
    sbtn: `rgba(${pRgb.r},${pRgb.g},${pRgb.b},0.35)`,
    salert: `rgba(${dRgb.r},${dRgb.g},${dRgb.b},0.4)`,
  };
}
/* Background tone overrides (applies on top of any palette) */
function withBgTone(pal, tone) {
  if (!tone || tone === "warm") return pal;
  const { h, s: sp } = rgbToHsl(hexToRgb(pal.primary));
  const out = { ...pal };
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
/* Resolve exactly the way the client's applyTheme does */
function resolvePalette(cfg) {
  let pal = PALETTES[cfg.preset];
  if (!pal) {
    const ok = (v, fb) =>
      /^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : fb;
    pal = deriveWarm(ok(cfg.primary, "#7c1d33"), ok(cfg.accent, "#d4a94f"));
  }
  const { l: lp } = rgbToHsl(hexToRgb(pal.primary));
  if (lp > 0.6) pal = deriveWarm(shade(pal.primary, -0.35), pal.accent);
  return withBgTone(pal, cfg.bgTone);
}

const DEFAULTS = {
  preset: "maroon",
  primary: "#7c1d33",
  accent: "#d4a94f",
  fontHead: "playfair",
  fontBody: "inter",
  bgTone: "warm",
};

const BG_TONES = [
  { key: "warm", name: "Warm Tint", sub: "Brand-hued page glow" },
  { key: "neutral", name: "Soft Ivory", sub: "Barely-there neutral" },
  { key: "white", name: "Pure White", sub: "Clean, high contrast" },
];

export default function AppearancePage() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, isError } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/settings");
        const a = (d.settings && d.settings.appearance) || {};
        setCfg({
          preset: a.preset || "maroon",
          primary: (a.primary || DEFAULTS.primary).toLowerCase(),
          accent: (a.accent || DEFAULTS.accent).toLowerCase(),
          fontHead: a.fontHead || "playfair",
          fontBody: a.fontBody || "inter",
          bgTone: a.bgTone || "warm",
        });
      } catch (e) {
        showToast(e.message, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Resolved palette + readability flag (mirrors the client) */
  const resolved = useMemo(() => (cfg ? resolvePalette(cfg) : null), [cfg]);
  const tooLight = useMemo(() => {
    if (!cfg) return false;
    const base = PALETTES[cfg.preset] ? PALETTES[cfg.preset].primary : cfg.primary;
    return rgbToHsl(hexToRgb(base)).l > 0.6;
  }, [cfg]);

  const headCss = (HEAD_FONTS.find((f) => f.key === cfg?.fontHead) || HEAD_FONTS[0]).css;
  const bodyCss = (BODY_FONTS.find((f) => f.key === cfg?.fontBody) || BODY_FONTS[0]).css;

  const pickPreset = (p) =>
    setCfg((c) => ({ ...c, preset: p.key, primary: p.primary, accent: p.accent }));

  const setColor = (key, value) => {
    const v = value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(v)) return;
    setCfg((c) => ({ ...c, [key]: v, preset: "custom" }));
  };

  const save = async () => {
    if (!cfg) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(cfg.primary)) return showToast("Invalid primary color", true);
    if (!/^#[0-9a-fA-F]{6}$/.test(cfg.accent)) return showToast("Invalid accent color", true);
    setSaving(true);
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          appearance: {
            preset: cfg.preset,
            primary: cfg.primary,
            accent: cfg.accent,
            fontHead: cfg.fontHead,
            fontBody: cfg.fontBody,
            bgTone: cfg.bgTone,
          },
        }),
      });
      showToast("Saved — new theme broadcast live to every online user");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setCfg({ ...DEFAULTS });

  return (
    <AdminShell
      title="Font & Color"
      sub="One-click theme — recolor and restyle the entire client website"
    >
      <Toast message={toast} isError={isError} />

      {!cfg || !resolved ? (
        <Loader />
      ) : (
        <div className="mx-auto flex max-w-[920px] flex-col gap-5">
          {/* ===== PRESETS ===== */}
          <div className="admin-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Palette size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">
                Color Themes — one click
              </div>
              <span className="ml-auto rounded-full bg-[#f6eef0] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-maroon-700">
                12 presets
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-[#fbf3f4] px-4 py-3 text-[12.5px] font-medium leading-relaxed text-[#7d6a6e]">
              <Info size={16} className="mt-0.5 shrink-0 text-maroon-600" />
              <span>
                Tap a theme and press Save. Every shade (buttons, headers, cards,
                badges, gradients, text tones) is professionally hand-tuned — and
                the new look is pushed to all online users instantly, no reload.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const pal = PALETTES[p.key];
                const active = cfg.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.97] ${
                      active
                        ? "border-maroon-700 shadow-[0_8px_20px_rgba(124,29,51,0.25)]"
                        : "border-line-rose hover:border-maroon-600/40"
                    }`}
                  >
                    <div className="flex h-9 overflow-hidden rounded-xl">
                      <span className="flex-[3]" style={{ background: pal.primary }} />
                      <span className="flex-1" style={{ background: pal.accent }} />
                      <span className="flex-1" style={{ background: pal.tint2 }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="truncate text-[12.5px] font-bold text-ink">{p.name}</span>
                      {active && <Check size={14} className="shrink-0 text-maroon-700" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== CUSTOM BRAND COLORS ===== */}
          <div className="admin-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-[16px] font-bold text-ink">Custom Brand Colors</div>
              {cfg.preset === "custom" && (
                <span className="rounded-full bg-[#f6eef0] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-maroon-700">
                  Custom active
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { key: "primary", label: "Primary Color", hint: "Buttons, header, main brand" },
                { key: "accent", label: "Accent / Gold Color", hint: "Highlights, pills, icons" },
              ].map(({ key, label, hint }) => (
                <div key={key} className="flex flex-col gap-3 rounded-xl border border-line-rose bg-[#fdfafa] p-3.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={cfg[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-line-rose bg-white p-1"
                      aria-label={label}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-ink">{label}</div>
                      <div className="text-[11.5px] font-medium text-muted-rose">{hint}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase text-muted-rose">HEX</span>
                    <input
                      type="text"
                      value={cfg[key]}
                      onChange={(e) => setColor(key, e.target.value)}
                      maxLength={7}
                      spellCheck={false}
                      className="admin-input flex-1 !py-2 font-mono text-[12.5px] uppercase"
                      aria-label={label + " hex"}
                    />
                  </div>
                </div>
              ))}
            </div>
            {tooLight && (
              <div className="flex items-start gap-2.5 rounded-xl bg-[#fff7e8] px-4 py-3 text-[12px] font-medium leading-relaxed text-[#8a6116]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Very light primary — white text on buttons would be unreadable, so
                  the client automatically deepens the button shade. Consider a
                  richer color for the exact look you pick.
                </span>
              </div>
            )}
          </div>

          {/* ===== BACKGROUND TONE ===== */}
          <div className="admin-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <SunIcon />
              <div className="font-display text-[16px] font-bold text-ink">Page Background Tone</div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {BG_TONES.map((t) => {
                const tonePal = withBgTone(PALETTES[cfg.preset] || deriveWarm(cfg.primary, cfg.accent), t.key);
                const active = cfg.bgTone === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setCfg((c) => ({ ...c, bgTone: t.key }))}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.97] ${
                      active
                        ? "border-maroon-700 shadow-[0_8px_20px_rgba(124,29,51,0.18)]"
                        : "border-line-rose hover:border-maroon-600/40"
                    }`}
                  >
                    <span
                      className="h-11 w-11 shrink-0 rounded-xl border"
                      style={{
                        background: `linear-gradient(150deg, ${tonePal.bg} 0%, ${tonePal.tint2} 55%, ${tonePal.line} 100%)`,
                        borderColor: tonePal.line,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">{t.name}</span>
                      <span className="block truncate text-[11px] font-medium text-muted-rose">{t.sub}</span>
                    </span>
                    {active && <Check size={15} className="shrink-0 text-maroon-700" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== FONTS ===== */}
          <div className="admin-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Type size={17} className="text-maroon-700" />
              <div className="font-display text-[16px] font-bold text-ink">Font Style</div>
              <span className="ml-auto rounded-full bg-[#f6eef0] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-maroon-700">
                12 + 10 fonts
              </span>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.5px] text-muted-rose">
                Headings — titles & buttons
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {HEAD_FONTS.map((f) => {
                  const active = cfg.fontHead === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCfg((c) => ({ ...c, fontHead: f.key }))}
                      className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.97] ${
                        active ? "border-maroon-700 bg-[#fbf3f4]" : "border-line-rose hover:border-maroon-600/40"
                      }`}
                    >
                      <div className="truncate text-[17px] font-bold text-ink" style={{ fontFamily: f.css }}>
                        Earn Daily
                      </div>
                      <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-rose">
                        {f.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.5px] text-muted-rose">
                Body Text — labels & content
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {BODY_FONTS.map((f) => {
                  const active = cfg.fontBody === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCfg((c) => ({ ...c, fontBody: f.key }))}
                      className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.97] ${
                        active ? "border-maroon-700 bg-[#fbf3f4]" : "border-line-rose hover:border-maroon-600/40"
                      }`}
                    >
                      <div className="truncate text-[14.5px] font-semibold text-ink" style={{ fontFamily: f.css }}>
                        Daily income ₹63.60
                      </div>
                      <div className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.5px] text-muted-rose">
                        {f.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== LIVE PREVIEW ===== */}
          <div className="admin-card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-[16px] font-bold text-ink">Live Preview</div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#f6eef0] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-maroon-700">
                <Zap size={11} />
                Exact client output
              </span>
            </div>
            <Preview pal={resolved} headCss={headCss} bodyCss={bodyCss} />
          </div>

          {/* ===== SAVE ===== */}
          <div className="sticky bottom-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={reset}
              className="admin-btn flex cursor-pointer items-center gap-2 rounded-[12px] border border-line-rose bg-white px-5 py-3 text-[13px] font-bold text-[#7d6a6e] transition-all hover:bg-[#fbf3f4]"
            >
              <RotateCcw size={15} />
              Reset to Default
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary px-8 shadow-[0_10px_26px_rgba(124,29,51,0.35)]"
              onClick={save}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Theme"}
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/* Small inline sun icon (kept dependency-light) */
function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-maroon-700">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/* ============ MINI SITE PREVIEW (resolved palette — exactly what the
   client computes: preset literals / warm HSL derivation + bgTone) ============ */
function Preview({ pal, headCss, bodyCss }) {
  const v = pal;
  return (
    <div
      className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[26px] border bg-white"
      style={{ borderColor: v.line, boxShadow: `0 20px 50px ${v.salert}` }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{
          background: `linear-gradient(135deg, ${v.deep} 0%, ${v.primary} 55%, ${v.primary2} 100%)`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-[26px] w-[26px] place-items-center rounded-full border-2 bg-white/10 text-[10px] font-extrabold text-white"
            style={{ borderColor: v.accent }}
          >
            Z
          </span>
          <div>
            <div className="text-[13px] font-bold leading-none text-white" style={{ fontFamily: headCss }}>
              SAUDI ARAMCO
            </div>
            <div className="mt-0.5 text-[7px] font-medium leading-none" style={{ color: v.accent }}>
              Earn daily, withdraw daily
            </div>
          </div>
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[9px] font-bold text-white"
          style={{
            borderColor: `color-mix(in srgb, ${v.accent} 40%, transparent)`,
            background: "rgba(255,255,255,0.1)",
          }}
        >
          ₹275.00
        </span>
      </div>

      {/* body */}
      <div className="px-3 py-3" style={{ background: `linear-gradient(180deg, ${v.bg} 0%, ${v.tint2} 100%)`, fontFamily: bodyCss }}>
        {/* page title + badge */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold" style={{ color: v.ink, fontFamily: headCss }}>
            Recharge
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-[0.5px]"
            style={{ background: v.tint2, color: v.primary }}
          >
            Min ₹530
          </span>
        </div>

        {/* amount card */}
        <div className="mt-2 rounded-2xl border bg-white p-3" style={{ borderColor: v.line }}>
          <div className="text-[8.5px] font-bold" style={{ color: v.ink }}>
            Amount
          </div>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: v.tint }}>
            <span className="text-[11px] font-bold" style={{ color: v.primary }}>
              ₹
            </span>
            <span className="text-[9.5px] font-medium" style={{ color: v.muted }}>
              Enter Amount
            </span>
          </div>
          <div className="mt-2 flex gap-1.5">
            {["₹600", "₹2,200"].map((q) => (
              <span
                key={q}
                className="rounded-full border px-2.5 py-1 text-[8.5px] font-bold"
                style={{ borderColor: v.line, color: v.ink }}
              >
                {q}
              </span>
            ))}
          </div>
          <div
            className="mt-2.5 rounded-lg py-2 text-center text-[10.5px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${v.primary} 0%, ${v.primary2} 55%, ${v.primary} 100%)`,
              boxShadow: `0 6px 14px ${v.sbtn}`,
              fontFamily: headCss,
            }}
          >
            Pay
          </div>
        </div>

        {/* plan card */}
        <div className="mt-2 rounded-2xl border bg-white p-3" style={{ borderColor: v.line }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold" style={{ color: v.ink, fontFamily: headCss }}>
                Starter Plan
              </div>
              <div className="text-[8px] font-semibold" style={{ color: v.muted }}>
                Daily income
              </div>
            </div>
            <span
              className="rounded-full px-2 py-1 text-[8px] font-extrabold"
              style={{ background: v.tint2, color: v.primary }}
            >
              ₹63.60 / day
            </span>
          </div>
          <div
            className="mt-2 rounded-lg py-1.5 text-center text-[9.5px] font-extrabold"
            style={{ background: v.tint, color: v.primary }}
          >
            Buy Now
          </div>
        </div>

        {/* bottom nav */}
        <div
          className="mt-2 flex items-center justify-around rounded-xl border bg-white/95 py-1.5"
          style={{ borderColor: v.line }}
        >
          {["Home", "Recharge", "Invite"].map((n, i) => (
            <span
              key={n}
              className="text-[8px] font-semibold"
              style={{ color: i === 1 ? v.primary : v.muted }}
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
