"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, TrendingDown, Percent, FileCheck2, ArrowRight, Wallet } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useOrganization, useProfile } from "@/lib/profile-context";
import type { DisclosureSummary, LeaseRegisterRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_COLORS = ["#1c3687", "#ed1b2f", "#3b5bb5", "#f2724f", "#6b7fc7", "#9aa8d6"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const org = useOrganization();
  const profile = useProfile();
  const [summary, setSummary] = useState<DisclosureSummary | null>(null);
  const [leases, setLeases] = useState<LeaseRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DisclosureSummary>("/reports/disclosures"),
      api.get<LeaseRegisterRow[]>("/reports/lease-register"),
    ])
      .then(([disclosures, register]) => {
        setSummary(disclosures);
        setLeases(register);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCount = leases.filter((l) => l.status === "ACTIVE").length;
  const exceptions = leases.filter((l) => l.status === "DRAFT").length;
  const score = leases.length ? Math.round((activeCount / leases.length) * 100) : 100;
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  // Ring geometry
  const R = 52, C = 2 * Math.PI * R;
  const dash = (score / 100) * C;

  const byCategory = new Map<string, number>();
  for (const l of leases) {
    const v = parseFloat(l.current_rou_nbv ?? "0");
    if (v > 0) byCategory.set(l.asset_category, (byCategory.get(l.asset_category) ?? 0) + v);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryTotal = categories.reduce((s, [, v]) => s + v, 0) || 1;

  const stats = [
    { label: "TOTAL ROU ASSET (NBV)", value: formatCurrency(summary?.total_rou_asset_nbv ?? "0"), icon: Building2, dot: "bg-edme-blue", sub: "Right-of-use assets, net" },
    { label: "LEASE LIABILITY", value: formatCurrency(summary?.total_lease_liability ?? "0"), icon: TrendingDown, dot: "bg-edme-red", sub: `Current ${formatCurrency(summary?.current_lease_liability ?? "0")} · Non-cur ${formatCurrency(summary?.non_current_lease_liability ?? "0")}` },
    { label: "WEIGHTED AVG. DISCOUNT RATE", value: `${(parseFloat(summary?.weighted_average_discount_rate ?? "0") * 100).toFixed(2)}%`, icon: Percent, dot: "bg-violet-500", sub: "Across active leases" },
    { label: "ACTIVE LEASES", value: String(activeCount), icon: FileCheck2, dot: "bg-emerald-500", sub: `${exceptions} draft${exceptions === 1 ? "" : "s"} pending calculation` },
  ];

  return (
    <div className="space-y-6">
      {/* Hero with Control Score ring */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-edme-blue-deep via-edme-blue-2 to-edme-blue px-7 py-7 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-edme-red/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        <div className="relative flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">{dateLabel} · Consolidated view</p>
            <h1 className="mt-2 text-3xl font-bold">
              {greeting()}, <span className="font-serif italic">{(profile?.full_name ?? "Admin").split(" ")[0]}</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/70">
              Where {org?.name ?? "your organization"}&apos;s lease accounting stands today under {org?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"} — across every lease.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/leases/new" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-edme-blue hover:bg-white/90">New lease <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Reports &amp; disclosures</Link>
            </div>
          </div>
          {/* Score ring */}
          <div className="relative hidden shrink-0 sm:block">
            <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
              <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
              <circle cx="66" cy="66" r={R} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{loading ? "…" : score}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60">Portfolio score</span>
            </div>
            <p className="mt-2 text-center text-xs text-white/60">{exceptions} open exception{exceptions === 1 ? "" : "s"}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, dot, sub }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "…" : value}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent leases</CardTitle>
            <Link href="/leases" className="text-sm font-medium text-edme-blue hover:underline">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Lease</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">ROU NBV</th>
                  <th className="px-5 py-2 font-medium text-right">Liability</th>
                </tr>
              </thead>
              <tbody>
                {leases.slice(0, 8).map((lease) => (
                  <tr key={lease.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/leases/${lease.id}`} className="font-medium text-edme-blue hover:underline">{lease.lease_code}</Link>
                      <span className="ml-2 text-slate-400">{lease.asset_name}</span>
                    </td>
                    <td className="px-5 py-3"><Badge variant={statusVariant(lease.status)}>{lease.status}</Badge></td>
                    <td className="px-5 py-3 text-right">{lease.current_rou_nbv ? formatCurrency(lease.current_rou_nbv) : "—"}</td>
                    <td className="px-5 py-3 text-right">{lease.current_lease_liability ? formatCurrency(lease.current_lease_liability) : "—"}</td>
                  </tr>
                ))}
                {!loading && leases.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No leases yet. Create your first lease to get started.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>ROU assets by class</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {categories.length === 0 && <p className="text-sm text-slate-400">Calculate a lease to see the composition.</p>}
            {categories.map(([cat, val], i) => {
              const pct = (val / categoryTotal) * 100;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{cat}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(val)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
            <Link href="/deposits" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-edme-blue hover:underline">
              <Wallet className="h-4 w-4" /> View security deposits
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
