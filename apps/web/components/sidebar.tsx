"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, Building2, BarChart3, LogOut, Users, Wallet,
  Landmark, History, Percent, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useOrganization, useProfile } from "@/lib/profile-context";

const MODULES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tint: "bg-sky-500/90" },
  { href: "/leases", label: "Lease Repository", icon: FileText, tint: "bg-indigo-500/90" },
  { href: "/lessors", label: "Lessor Master", icon: Building2, tint: "bg-violet-500/90" },
  { href: "/deposits", label: "Security Deposits", icon: Wallet, tint: "bg-teal-500/90" },
  { href: "/reports", label: "Reports & Disclosures", icon: BarChart3, tint: "bg-amber-500/90" },
];

const ADMIN = [
  { href: "/admin/users", label: "Users", icon: Users, tint: "bg-rose-500/90" },
  { href: "/admin/company", label: "Company Master", icon: Landmark, tint: "bg-blue-500/90" },
  { href: "/admin/discount-rate", label: "Discount Rate Engine", icon: Percent, tint: "bg-emerald-500/90" },
  { href: "/admin/audit", label: "Audit Trail", icon: History, tint: "bg-slate-400/90" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const organization = useOrganization();
  const isAdmin = profile?.role === "ADMIN";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavItem({ href, label, icon: Icon, tint }: (typeof MODULES)[number]) {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          active ? "bg-white/15 text-white shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
      >
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm", tint)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-opacity", active ? "opacity-70" : "opacity-0 group-hover:opacity-50")} />
      </Link>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col bg-linear-to-b from-edme-blue-deep via-edme-blue-2 to-edme-blue">
      {/* Logo + org */}
      <div className="px-5 pb-3 pt-5">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
          <img src="/edme-logo.svg" alt="edme" className="h-7" />
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-edme-red text-[11px] font-bold text-white">LP</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">{organization?.name ?? "LeasePro AI"}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-white/50">
              {organization?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"} · Edme
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-2">
        <Link
          href="/leases/new"
          className="flex items-center gap-3 rounded-xl bg-linear-to-r from-edme-red to-edme-red-2 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-105"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20"><Sparkles className="h-4 w-4" /></span>
          New lease
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Modules</p>
        {MODULES.map((item) => <NavItem key={item.href} {...item} />)}
        {isAdmin && (
          <>
            <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Administration</p>
            {ADMIN.map((item) => <NavItem key={item.href} {...item} />)}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><LogOut className="h-4 w-4" /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
