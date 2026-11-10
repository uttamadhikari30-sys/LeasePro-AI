"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, TrendingDown, Percent, FileCheck2, ArrowRight, Wallet, CalendarClock, Banknote } from "lucide-react";
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

// Compact Indian currency for chart labels (₹1.2 Cr / ₹3.4 L)
function compact(v: number, ccy = "INR") {
  const sym = ccy === "INR" ? "₹" : "";
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sym}${(v / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(1)} K`;
  return `${sym}${v.toFixed(0)}`;
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

  const ccy = org?.functional_currency ?? "INR";
  const activeCount = leases.filter((l) => l.status === "ACTIVE").length;
  const exceptions = leases.filter((l) => l.status === "DRAFT").length;
  const score = leases.length ? Math.round((activeCount / leases.length) * 100) : 100;
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  // Hero ring
  const R = 52, C = 2 * Math.PI * R;
  const dash = (score / 100) * C;

  // Liability split
  const current = parseFloat(summary?.current_lease_liability ?? "0");
  const nonCurrent = parseFloat(summary?.non_current_lease_liability ?? "0");
  const totalLiab = current + nonCurrent || parseFloat(summary?.total_lease_liability ?? "0");
  const curPct = totalLiab ? current / totalLiab : 0;
  // Donut geometry
  const DR = 46, DC = 2 * Math.PI * DR;

  // Maturity profile
  const maturity = (summary?.maturity_analysis ?? []).map((b) => ({ label: b.label, value: parseFloat(b.undiscounted_amount) || 0 }));
  const maxMat = Math.max(1, ...maturity.map((b) => b.value));
  const maturityTotal = maturity.reduce((s, b) => s + b.value, 0);

  // ROU by class
  const byCategory = new Map<string, number>();
  for (const l of leases) {
    const v = parseFloat(l.current_rou_nbv ?? "0");
    if (v > 0) byCategory.set(l.asset_category, (byCategory.get(l.asset_category) ?? 0) + v);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryTotal = categories.reduce((s, [, v]) => s + v, 0) || 1;

  // Upcoming expiries (active leases ending within 12 months)
  const now = new Date();
  const expiries = leases
    .filter((l) => l.status === "ACTIVE")
    .map((l) => {
      const e = new Date(l.commencement_date);
      e.setMonth(e.getMonth() + l.lease_term_months);
      const mo = (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth());
      return { l, e, mo };
    })
    .filter((x) => x.mo >= 0 && x.mo <= 12)
    .sort((a, b) => a.mo - b.mo)
    .slice(0, 5);

  const stats = [
    { label: "TOTAL ROU ASSET (NBV)", value: formatCurrency(summary?.total_rou_asset_nbv ?? "0", ccy), icon: Building2, dot: "bg-edme-blue", sub: "Right-of-use assets, net" },
    { label: "LEASE LIABILITY", value: formatCurrency(summary?.total_lease_liability ?? "0", ccy), icon: TrendingDown, dot: "bg-edme-red", sub: `Current ${compact(current, ccy)} · Non-cur ${compact(nonCurrent, ccy)}` },
    { label: "WEIGHTED AVG. DISCOUNT RATE", value: `${(parseFloat(summary?.weighted_average_discount_rate ?? "0") * 100).toFixed(2)}%`, icon: Percent, dot: "bg-violet-500", sub: "Across active leases" },
    { label: "CASH OUTFLOW (YTD)", value: formatCurrency(summary?.total_cash_outflow_ytd ?? "0", ccy), icon: Banknote, dot: "bg-emerald-500", sub: `${activeCount} active · ${exceptions} draft${exceptions === 1 ? "" : "s"}` },
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
          <div key={label} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "…" : value}</p>
            <p className="mt-1 text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Maturity profile + Liability composition */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Lease liability maturity profile</CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">Undiscounted contractual lease payments · Ind AS 107</p>
            </div>
            <span className="rounded-lg bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">Total {compact(maturityTotal, ccy)}</span>
          </CardHeader>
          <CardContent>
            {maturity.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Calculate leases to build the maturity profile.</p>
            ) : (
              <div className="flex h-56 items-stretch gap-4 pt-4">
                {maturity.map((b, i) => {
                  const h = Math.max(4, (b.value / maxMat) * 100);
                  return (
                    <div key={b.label} className="group flex flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">{compact(b.value, ccy)}</span>
                      <div className="relative w-full overflow-hidden rounded-t-lg" style={{ height: `${h}%`, minHeight: 6, background: `linear-gradient(180deg, ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}, ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}cc)` }}>
                        <div className="absolute inset-x-0 top-0 h-1/3 bg-white/15" />
                      </div>
                      <span className="text-center text-[11px] font-medium leading-tight text-slate-500">{b.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle>Liability composition</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-2">
              <div className="relative">
                <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
                  <circle cx="75" cy="75" r={DR} fill="none" stroke="#eef1f8" strokeWidth="16" />
                  <circle cx="75" cy="75" r={DR} fill="none" stroke="#1c3687" strokeWidth="16" strokeDasharray={`${curPct * DC} ${DC}`} strokeLinecap="round" />
                  <circle cx="75" cy="75" r={DR} fill="none" stroke="#ed1b2f" strokeWidth="16" strokeDasharray={`${(1 - curPct) * DC} ${DC}`} strokeDashoffset={`${-curPct * DC}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
                  <span className="text-base font-bold text-slate-900">{compact(totalLiab, ccy)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-edme-blue" /> Current (≤ 12 mo)</span>
                <span className="font-medium text-slate-900">{formatCurrency(current, ccy)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-edme-red" /> Non-current (&gt; 12 mo)</span>
                <span className="font-medium text-slate-900">{formatCurrency(nonCurrent, ccy)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent leases + right rail */}
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
                    <td className="px-5 py-3 text-right">{lease.current_rou_nbv ? formatCurrency(lease.current_rou_nbv, ccy) : "—"}</td>
                    <td className="px-5 py-3 text-right">{lease.current_lease_liability ? formatCurrency(lease.current_lease_liability, ccy) : "—"}</td>
                  </tr>
                ))}
                {!loading && leases.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No leases yet. Create your first lease to get started.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="space-y-6">
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
                      <span className="font-medium text-slate-900">{formatCurrency(val, ccy)}</span>
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

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-2">
              <CalendarClock className="h-4 w-4 text-edme-red" />
              <CardTitle>Expiring within 12 months</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiries.length === 0 && <p className="text-sm text-slate-400">No active leases expiring in the next year.</p>}
              {expiries.map(({ l, e, mo }) => (
                <Link key={l.id} href={`/leases/${l.id}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 transition hover:border-edme-blue/30 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{l.lease_code} <span className="font-normal text-slate-400">{l.asset_name}</span></p>
                    <p className="text-xs text-slate-400">Ends {e.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${mo <= 3 ? "bg-edme-red/10 text-edme-red" : "bg-amber-100 text-amber-700"}`}>
                    {mo === 0 ? "This month" : `${mo} mo`}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
