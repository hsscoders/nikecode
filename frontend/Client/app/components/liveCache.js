"use client";

/* ============ localStorage instant-cache (stale-while-revalidate) ============
   Refresh par network ka intezaar nahi — pichhli baar ka data localStorage
   se TURANT render hota hai, phir background me fresh data aa jata hai.
  Har page j jo API se aata hai (wallet/banners/plans/invite-ref) yahan
   cache hota hai taaki repeat visit 100% instant lage. */

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
