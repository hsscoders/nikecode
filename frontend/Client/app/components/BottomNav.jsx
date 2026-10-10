"use client";

import { useRouter } from "next/navigation";
import { Home, IndianRupee, Users, ReceiptText, User } from "lucide-react";

const ITEMS = [
  { label: "Home", Icon: Home, to: "/home" },
  { label: "Recharge", Icon: IndianRupee, to: "/recharge" },
  { label: "Invite", Icon: Users, to: "/invite" },
  { label: "Records", Icon: ReceiptText, to: "/records" },
  { label: "Account", Icon: User, to: "/profile" },
];

/* Fixed bottom navigation shared by every page.
   - Labels always visible (compact height, so phone browser bars
     can never push them off-screen)
   - Truly fixed: stays put while the page scrolls
   - Solid background — no backdrop-blur glitches on Android WebViews
   - Safe-area aware (gesture bars / notches)
   - Width mirrors the page column: full-bleed on phones (no pink
     side-gaps on ~430-520px viewports), 430px card-width on desktop */
export default function BottomNav({ active = -1 }) {
  const router = useRouter();
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full min-[520px]:max-w-[430px] -translate-x-1/2 border-t border-line-rose bg-white">
      <div
        className="grid grid-cols-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {ITEMS.map(({ label, Icon, to }, i) => {
          const on = i === active;
          return (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className="flex cursor-pointer flex-col items-center gap-[3px] px-0.5 pt-[7px] pb-[6px]"
              onClick={() => {
                if (on) return;
                router.push(to);
              }}
            >
              <Icon
                size={20}
                strokeWidth={on ? 2.4 : 2}
                className={on ? "text-maroon-700" : "text-[#b9a5aa]"}
              />
              <span
                className={`text-[10.5px] font-bold leading-none ${
                  on ? "text-maroon-700" : "text-[#b9a5aa]"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
