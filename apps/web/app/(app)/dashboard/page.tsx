"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, TrendingDown, Percent, FileCheck2, ArrowRight, Wallet } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useOrganization } from "@/lib/profile-context";
import type { DisclosureSummary, LeaseRegisterRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_COLORS = ["#1c3687", "#ed1b2f", "#3b5bb5", "#f2724f", "#6b7fc7", "#9aa8d6"];

export default function DashboardPage() {
  const org = useOrganization();
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

  // ROU composition by asset category
  const byCategory = new Map<string, number>();
  for (const l of leases) {
    const v = parseFloat(l.current_rou_nbv ?? "0");
    if (v > 0) byCategory.set(l.asset_category, (byCategory.get(l.asset_category) ?? 0) + v);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryTotal = categories.reduce((s, [, v]) => s + v, 0) || 1;

  const stats = [
    { label: "Total ROU Asset (NBV)", value: formatCurrency(summary?.total_rou_asset_nbv ?? "0"), icon: Building2, tint: "text-edme-blue", bg: "bg-edme-blue/10" },
    { label: "Total Lease Liability", value: formatCurrency(summary?.total_lease_liability ?? "0"), icon: TrendingDown, tint: "text-edme-red", bg: "bg-edme-red/10" },
    { label: "Weighted Avg. Discount Rate", value: `${(parseFloat(summary?.weighted_average_discount_rate ?? "0") * 100).toFixed(2)}%`, icon: Percent, tint: "text-violet-600", bg: "bg-violet-100" },
    { label: "Active Leases", value: String(activeCount), icon: FileCheck2, tint: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-edme-blue-deep via-edme-blue-2 to-edme-blue px-7 py-8 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-edme-red/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">{org?.name ?? "LeasePro AI"}</p>
          <h1 className="mt-1 text-2xl font-bold">Portfolio overview</h1>
          <p className="mt-1 text-sm text-white/70">
            Lease accounting under {org?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"} — right-of-use assets, liabilities and disclosures at a glance.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/leases/new" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-edme-blue shadow-sm hover:bg-white/90">
              New lease <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/reports" className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
              Reports &amp; disclosures
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 py-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${tint}`} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 text-xl font-semibold text-slate-900">{loading ? "…" : value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent leases */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent leases</CardTitle>
            <Link href="/leases" className="text-sm font-medium text-edme-blue hover:underline">View all</Link>
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

        {/* ROU composition */}
        <Card>
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
