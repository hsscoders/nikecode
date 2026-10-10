"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Gem,
  Images,
  Percent,
  Users,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings,
  SlidersHorizontal,
  Bell,
  Clock3,
  Palette,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Globe,
} from "lucide-react";
import { io } from "socket.io-client";
import logo from "../public/admin-logo.png";

const NAV = [
  {
    section: "Overview",
    items: [{ label: "Dashboard", href: "/admin", Icon: LayoutDashboard, exact: true }],
  },
  {
    section: "Management",
    items: [
      { label: "Manage Plans", href: "/admin/plans", Icon: Gem },
      { label: "Banner Slider", href: "/admin/banners", Icon: Images },
      { label: "Invite Commission", href: "/admin/commission", Icon: Percent },
      { label: "Manage Users", href: "/admin/users", Icon: Users },
    ],
  },
  {
    section: "Records",
    items: [
      { label: "Invest Records", href: "/admin/invests", Icon: TrendingUp },
      { label: "Deposits", href: "/admin/deposits", Icon: ArrowDownToLine },
      { label: "Withdrawals", href: "/admin/withdrawals", Icon: ArrowUpFromLine },
    ],
  },
  {
    section: "System",
    items: [
      {
        label: "Settings",
        Icon: Settings,
        children: [
          { label: "Site Settings", href: "/admin/settings", Icon: SlidersHorizontal },
          { label: "Popup", href: "/admin/settings/popup", Icon: Bell },
          { label: "Font & Color", href: "/admin/settings/appearance", Icon: Palette },
          { label: "Recharge Setting", href: "/admin/settings/recharge", Icon: ArrowDownToLine },
          { label: "Withdrawal Setting", href: "/admin/settings/withdraw", Icon: ArrowUpFromLine },
          { label: "Income Time", href: "/admin/settings/income-time", Icon: Clock3 },
        ],
      },
    ],
  },
];

export default function AdminShell({ title, sub, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [ready, setReady] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [liveMsg, setLiveMsg] = useState("");
  const liveTimer = useRef(null);

  /* realtime — instant alert when a user submits a recharge / withdrawal */
  useEffect(() => {
    let sock;
    try {
      const token = localStorage.getItem("admin_token");
      sock = io({
        path: "/api/socket.io",
        addTrailingSlash: false,
        transports: ["polling", "websocket"],
        auth: { token },
        reconnectionDelayMax: 10000,
      });
      sock.on("txns:new", (d) => {
        clearTimeout(liveTimer.current);
        setLiveMsg((d && d.message) || "New request");
        liveTimer.current = setTimeout(() => setLiveMsg(""), 5000);
      });
    } catch (e) {}
    return () => {
      try {
        if (sock) sock.disconnect();
      } catch (e) {}
      clearTimeout(liveTimer.current);
    };
  }, []);

  /* Auto-open the drop-down when a child route is active (refresh / direct link too) */
  useEffect(() => {
    NAV.forEach((g) =>
      g.items.forEach((item) => {
        if (item.children && item.children.some((c) => pathname === c.href)) {
          setOpenMenus((m) => (m[item.label] ? m : { ...m, [item.label]: true }));
        }
      })
    );
  }, [pathname]);

  /* token guard — admin panel will not open without login */
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  const logout = () => {
    localStorage.removeItem("admin_token");
    router.replace("/admin/login");
  };

  /* Go to Website — opens the client site.
     1) NEXT_PUBLIC_CLIENT_URL (.env) always wins — set your server domain there
        (e.g. https://yourdomain.com) and rebuild once; no port needed.
     2) Fallback auto-detect: admin reached through the client's /admin proxy
        (same origin, no port) → that origin's root IS the client site;
        direct :3001 access falls back to the same hostname on port 3000. */
  const goSite = () => {
    const envUrl = (process.env.NEXT_PUBLIC_CLIENT_URL || "").trim();
    if (envUrl) return window.open(envUrl, "_blank", "noopener");
    const loc = window.location;
    const viaProxy = !loc.port && loc.pathname.startsWith("/admin");
    const url =
      viaProxy || loc.port === "3000"
        ? loc.origin
        : loc.protocol + "//" + loc.hostname + ":3000";
    window.open(url, "_blank", "noopener");
  };

  const SidebarBody = (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#42091a_0%,#571224_45%,#6b1830_100%)]">
      {/* LOGO */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <div className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full ring-2 ring-gold/70">
          <Image src={logo} alt="Admin logo" fill sizes="42px" className="object-cover" />
        </div>
        <div>
          <div className="font-display text-[19px] font-bold leading-none tracking-[0.5px] text-white">
            Admin Panel
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[1.2px] text-gold">
            Master Admin
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            <div className="mb-1.5 px-3 text-[9.5px] font-extrabold uppercase tracking-[1.4px] text-white/30">
              {group.section}
            </div>
            {group.items.map((item) => {
              /* ===== DROPDOWN ITEM (has children) ===== */
              if (item.children) {
                const isOpen = !!openMenus[item.label];
                const groupActive = item.children.some(
                  (c) => pathname === c.href || pathname.startsWith(c.href + "/")
                );
                return (
                  <div key={item.label} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenus((m) => ({ ...m, [item.label]: !m[item.label] }))
                      }
                      className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150 ${
                        groupActive
                          ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "text-white/55 hover:bg-white/[0.07] hover:text-white/85"
                      }`}
                    >
                      {groupActive && (
                        <span className="absolute left-0 top-1/2 h-[20px] w-[3px] -translate-y-1/2 rounded-r-full bg-gold" />
                      )}
                      <item.Icon
                        size={18}
                        strokeWidth={groupActive ? 2.3 : 2}
                        className={groupActive ? "text-gold" : "text-white/45 group-hover:text-white/70"}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-gold" : "text-white/45"
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mb-1 ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-white/12 pl-2.5">
                        {item.children.map(({ label, href, Icon: CIcon }) => {
                          const active = pathname === href;
                          return (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setDrawer(false)}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-all duration-150 ${
                                active
                                  ? "bg-white/12 text-white"
                                  : "text-white/50 hover:bg-white/[0.07] hover:text-white/85"
                              }`}
                            >
                              <CIcon
                                size={15}
                                strokeWidth={active ? 2.3 : 2}
                                className={active ? "text-gold" : "text-white/40"}
                              />
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              /* ===== PLAIN LINK ITEM ===== */
              const { label, href, Icon, exact } = item;
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawer(false)}
                  className={`group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-150 ${
                    active
                      ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "text-white/55 hover:bg-white/[0.07] hover:text-white/85"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-[20px] w-[3px] -translate-y-1/2 rounded-r-full bg-gold" />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={active ? 2.3 : 2}
                    className={active ? "text-gold" : "text-white/45 group-hover:text-white/70"}
                  />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight size={14} className="text-gold" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* LOGOUT */}
      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={logout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:block">{SidebarBody}</aside>

      {/* ===== MOBILE DRAWER ===== */}
      {drawer && (
        <div
          className="fixed inset-0 z-[70] bg-black/55 lg:hidden animate-[fade-in_0.15s_ease]"
          onClick={() => setDrawer(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-[280px] max-w-[86vw] animate-[slide-left_0.2s_ease] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {SidebarBody}
          </div>
        </div>
      )}

      {/* ===== MAIN ===== */}
      <div className="flex min-h-dvh flex-col lg:pl-[248px]">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line-rose bg-white/90 px-3 py-3 backdrop-blur sm:gap-3 sm:px-4 sm:py-3.5 lg:px-7">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line-rose text-maroon-700 lg:hidden"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[17px] font-bold leading-tight text-ink sm:text-[19px]">
              {title}
            </h1>
            {sub && <p className="mt-0.5 truncate text-[11px] font-medium text-muted-rose sm:text-[12px] sm:mt-0">{sub}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-line-rose bg-white px-2 py-1.5 pr-3.5 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-[12px] font-extrabold text-white">
              A
            </span>
            <span className="text-[12.5px] font-bold text-ink">Super Admin</span>
          </div>
          <button
            type="button"
            aria-label="Go to Website"
            title="Open the client website"
            onClick={goSite}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-maroon-700/25 bg-white px-2.5 text-[12.5px] font-bold text-maroon-700 transition-colors hover:bg-[#fbf1f3] sm:h-9 sm:px-3.5"
          >
            <Globe size={15} strokeWidth={2.2} />
            <span className="hidden md:inline">Go to Website</span>
          </button>
          <button
            type="button"
            aria-label="Logout"
            onClick={logout}
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-line-rose bg-white text-[#b27583] transition-colors hover:bg-[#fdecec] hover:text-[#dc2626] sm:h-9 sm:w-9"
          >
            <LogOut size={16} />
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-7 lg:py-6">{ready ? children : null}</main>

        {/* LIVE TOAST — realtime new request alerts (top center, all pages) */}
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-4 z-[90] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2.5 rounded-full bg-[linear-gradient(135deg,#42091a,#6b1830)] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_12px_30px_rgba(66,9,26,0.45)] transition-all duration-200 ${
            liveMsg ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="truncate">{liveMsg}</span>
        </div>

        {/* FOOTER */}
        <footer className="px-4 pb-5 pt-2 text-center text-[11.5px] font-medium text-[#b9a5aa] lg:px-7">
          Master Admin Panel · v1.0
        </footer>
      </div>
    </div>
  );
}
