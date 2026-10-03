"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { api } from "@/lib/api";
import { OrganizationContext, ProfileContext } from "@/lib/profile-context";
import type { Organization, Profile } from "@/lib/types";

function initials(name: string | null | undefined) {
  if (!name) return "LP";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "LP";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Profile>("/organizations/me/profile"),
      api.get<Organization>("/organizations/me"),
    ])
      .then(([p, org]) => {
        setProfile(p);
        setOrganization(org);
        setReady(true);
      })
      .catch(() => router.replace("/onboarding"));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={profile}>
      <OrganizationContext.Provider value={organization}>
        <div className="flex min-h-screen bg-slate-100">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-xl">
              <div className="relative hidden max-w-md flex-1 sm:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search leases, lessors, journals…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-edme-blue/40 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold leading-tight text-slate-900">{profile?.full_name ?? "Admin"}</p>
                  <p className="text-xs leading-tight text-slate-400">
                    {profile?.role === "ADMIN" ? "Administrator" : (profile?.role ?? "")} · {organization?.name ?? "Edme"}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-edme-blue to-edme-blue-2 text-sm font-bold text-white shadow-sm">
                  {initials(profile?.full_name)}
                </span>
              </div>
            </header>

            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
            </main>
          </div>
        </div>
      </OrganizationContext.Provider>
    </ProfileContext.Provider>
  );
}
