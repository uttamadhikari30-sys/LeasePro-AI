"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Building2, BarChart3, LogOut, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useOrganization, useProfile } from "@/lib/profile-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leases", label: "Lease Repository", icon: FileText },
  { href: "/lessors", label: "Lessor Master", icon: Building2 },
  { href: "/reports", label: "Reports & Disclosures", icon: BarChart3 },
];

const ADMIN_NAV_ITEMS = [{ href: "/admin/users", label: "Users", icon: Users }];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const organization = useOrganization();
  const navItems = profile?.role === "ADMIN" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-6 py-5">
        <img src="/edme-logo.svg" alt="edme" className="mb-3 h-6" />
        <p className="text-sm font-semibold leading-snug text-slate-900">
          {organization?.name ?? "LeasePro AI"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          LeasePro AI &middot; {organization?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"}
        </p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-edme-blue/10 text-edme-blue" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-3 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
