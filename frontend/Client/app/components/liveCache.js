"use client";

/* ============ instant-cache (stale-while-revalidate) — DB-first ============
   The SERVER (MySQL via API) is the single source of truth for all user data.
   This module only holds short-lived display caches so a refresh paints
   instantly instead of flashing an empty state, and the fresh values
   always arrive from the API right after.

   Storage split:
   - sessionStorage (per-tab, wiped when the tab closes, never hits disk):
     every USER-scoped cache — wallet, bank, orders, ledger, counters.
     Sensitive values (balances, bank account) never persist across tabs
     or survive a browser restart.
   - localStorage (survives refresh): PUBLIC content only — banners,
     plans, theme. Nothing user-specific ever lands here.

   Removed entirely (used to live in localStorage — DB is the truth now):
   - zapto_orders      → server /api/invests  (cache key "invests")
   - zapto_transactions→ server /api/transactions (cache key "txns")
   - zapto_bank_card   → server user.bank     (cache key "bank")
   - zapto_uid         → server wallet.userid
   Legacy keys are wiped on session cleanup so old devices self-heal. */

const PREFIX = "zapto_cache_";

/* cache keys that hold user data → sessionStorage */
const USER_KEYS = new Set(["wallet", "bank", "ref", "txns", "invests", "wdToday"]);

function storeFor(key) {
  if (typeof window === "undefined") return null;
  try {
    return USER_KEYS.has(key) ? window.sessionStorage : window.localStorage;
  } catch (e) {
    return null;
  }
}

export function readCache(key) {
  const store = storeFor(key);
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed.data ?? null : null;
  } catch (e) {
    return null;
  }
}

export function writeCache(key, data) {
  if (data === undefined) return;
  const store = storeFor(key);
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {}
}

export function clearCache(key) {
  if (typeof window === "undefined") return;
  try {
    if (key) {
      const store = storeFor(key);
      if (store) store.removeItem(PREFIX + key);
      return;
    }
    /* wipe the whole cache family from BOTH storages */
    for (const store of [window.localStorage, window.sessionStorage]) {
      Object.keys(store)
        .filter((k) => k.startsWith(PREFIX))
        .forEach((k) => store.removeItem(k));
    }
  } catch (e) {}
}

/* ============ per-user session wipe (logout / login switch / 401) ============
   Wipes EVERY user-specific key so the next account on this device never
   sees the previous one's balance, transactions, orders, invite code or
   saved bank card — from both storage areas, plus the legacy localStorage
   keys older app versions used to write. Public caches (banners/plans/
   settings) are kept — they are not user-specific. */
export function clearUserSession() {
  if (typeof window === "undefined") return;
  try {
    ["zapto_token", "zapto_phone"].forEach((k) => localStorage.removeItem(k));
    /* legacy keys from the pre-DB-first builds — always scrubbed */
    [
      "zapto_bank_card",
      "zapto_orders",
      "zapto_transactions",
      "zapto_uid",
    ].forEach((k) => localStorage.removeItem(k));
    ["wallet", "ref", "txns", "invests", "wdToday", "bank"].forEach((k) =>
      clearCache(k)
    );
  } catch (e) {}
}

/* ============ full logout (session wipe + live-socket de-auth) ============
   The shared socket keeps its JWT from connect time — after a logout it
   would still sit in the old user's push room and fire background
   /api/wallet fetches without a token (guaranteed 401s). Refreshing the
   socket auth drops it back to anonymous, exactly like a fresh visit. */
export function logoutUser() {
  clearUserSession();
  try {
    if (typeof window !== "undefined" && window.__zaptoSocketRefreshAuth)
      window.__zaptoSocketRefreshAuth();
  } catch (e) {}
}
