"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { DisclosureSummary, LeaseRegisterRow } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Portfolio overview under Ind AS 116 / IFRS 16.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>Total ROU Asset (NBV)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">
              {loading ? "…" : formatCurrency(summary?.total_rou_asset_nbv ?? "0")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Total Lease Liability</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">
              {loading ? "…" : formatCurrency(summary?.total_lease_liability ?? "0")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weighted Avg. Discount Rate</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">
              {loading ? "…" : `${(parseFloat(summary?.weighted_average_discount_rate ?? "0") * 100).toFixed(2)}%`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Active Leases</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{loading ? "…" : activeCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent leases</CardTitle>
          <Link href="/leases" className="text-sm font-medium text-indigo-600 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Lease Code</th>
                <th className="px-5 py-2 font-medium">Asset</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">ROU NBV</th>
                <th className="px-5 py-2 font-medium text-right">Liability</th>
              </tr>
            </thead>
            <tbody>
              {leases.slice(0, 8).map((lease) => (
                <tr key={lease.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/leases/${lease.id}`} className="font-medium text-indigo-600 hover:underline">
                      {lease.lease_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{lease.asset_name}</td>
                  <td className="px-5 py-3"><Badge variant={statusVariant(lease.status)}>{lease.status}</Badge></td>
                  <td className="px-5 py-3 text-right">{lease.current_rou_nbv ? formatCurrency(lease.current_rou_nbv) : "—"}</td>
                  <td className="px-5 py-3 text-right">{lease.current_lease_liability ? formatCurrency(lease.current_lease_liability) : "—"}</td>
                </tr>
              ))}
              {!loading && leases.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No leases yet. Create your first lease to get started.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
