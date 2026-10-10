"use client";

/* ============ localStorage instant-cache (stale-while-revalidate) ============
   No waiting for the network on refresh — data from the previous visit renders
   INSTANTLY from localStorage, then fresh data arrives in the background.
   Every page payload that comes from an API (wallet/banners/plans/invite-ref)
   is cached here so repeat visits feel 100% instant. */

const PREFIX = "zapto_cache_";

export function readCache(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed.data ?? null : null;
  } catch (e) {
    return null;
  }
}

export function writeCache(key, data) {
  if (typeof window === "undefined" || data === undefined) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {}
}

export function clearCache(key) {
  if (typeof window === "undefined") return;
  try {
    if (key) localStorage.removeItem(PREFIX + key);
    else
      Object.keys(localStorage)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
}

/* ============ per-user session wipe (logout / login switch / 401) ============
   Wipes EVERY user-specific localStorage key so the next account on this
   device never sees the previous one's balance, transactions, orders,
   invite code or saved bank card. Public caches (banners/plans/settings)
   are kept — they are not user-specific. */
export function clearUserSession() {
  if (typeof window === "undefined") return;
  try {
    ["zapto_token", "zapto_phone", "zapto_bank_card", "zapto_orders"].forEach((k) =>
      localStorage.removeItem(k)
    );
    ["wallet", "ref", "txns", "invests", "wdToday"].forEach((k) => clearCache(k));
  } catch (e) {}
}
