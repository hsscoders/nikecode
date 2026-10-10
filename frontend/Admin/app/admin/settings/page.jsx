import { redirect } from "next/navigation";

/* Login / Home / Limits settings pages removed — limits already live in
   Recharge Setting + Withdrawal Setting, texts use client defaults.
   /admin/settings ab Register Bonus par le jata hai. */
export default function SettingsIndex() {
  redirect("/admin/settings/register");
}
