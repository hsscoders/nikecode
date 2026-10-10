"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
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
    items: [{ label: "Site Settings", href: "/admin/settings", Icon: Settings }],
  },
];

export default function AdminShell({ title, sub, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [ready, setReady] = useState(false);

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
            {group.items.map(({ label, href, Icon, exact }) => {
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
            className="absolute inset-y-0 left-0 w-[262px] animate-[slide-left_0.2s_ease] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {SidebarBody}
          </div>
        </div>
      )}

      {/* ===== MAIN ===== */}
      <div className="flex min-h-dvh flex-col lg:pl-[248px]">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line-rose bg-white/90 px-4 py-3.5 backdrop-blur lg:px-7">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-line-rose text-maroon-700 lg:hidden"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[19px] font-bold leading-tight text-ink">
              {title}
            </h1>
            {sub && <p className="truncate text-[12px] font-medium text-muted-rose">{sub}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-line-rose bg-white px-2 py-1.5 pr-3.5 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(135deg,#7c1d33,#93293f)] text-[12px] font-extrabold text-white">
              A
            </span>
            <span className="text-[12.5px] font-bold text-ink">Super Admin</span>
          </div>
          <button
            type="button"
            aria-label="Logout"
            onClick={logout}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-line-rose bg-white text-[#b27583] transition-colors hover:bg-[#fdecec] hover:text-[#dc2626]"
          >
            <LogOut size={16} />
          </button>
        </header>

        {/* CONTENT */}
        <main className="flex-1 px-4 py-5 lg:px-7 lg:py-6">{ready ? children : null}</main>

        {/* FOOTER */}
        <footer className="px-4 pb-5 pt-2 text-center text-[11.5px] font-medium text-[#b9a5aa] lg:px-7">
          Master Admin Panel · v1.0
        </footer>
      </div>
    </div>
  );
}
