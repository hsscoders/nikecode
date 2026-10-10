"use client";

/* ============ Admin API helper — token auto-attach + 401 redirect ============ */

export async function api(path, opts = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;

  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {}),
    },
  });

  let data = {};
  try {
    data = await res.json();
  } catch {}

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
    window.location.href = "/admin/login";
    throw new Error("Session expired");
  }

  if (!res.ok || data.success === false)
    throw new Error(data.message || "Request failed");
  return data;
}

/* ============ FORMATTERS ============ */

export const fmt = (n) =>
  "\u20B9" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmt0 = (n) =>
  "\u20B9" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const fmtD = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/* Client app URL — used for the one-click login link */
export const CLIENT_URL = "http://localhost:3000";
