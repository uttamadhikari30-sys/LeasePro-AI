"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { api } from "@/lib/api";
import { OrganizationContext, ProfileContext } from "@/lib/profile-context";
import type { Organization, Profile } from "@/lib/types";

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
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </OrganizationContext.Provider>
    </ProfileContext.Provider>
  );
}
