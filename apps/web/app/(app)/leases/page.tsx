"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { LeaseRegisterRow } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function LeasesPage() {
  const [leases, setLeases] = useState<LeaseRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LeaseRegisterRow[]>("/reports/lease-register").then(setLeases).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lease Repository</h1>
          <p className="text-sm text-slate-500">Every lease under management, with its current ROU and liability balance.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leases/import">
            <Button variant="outline">Import from Excel</Button>
          </Link>
          <Link href="/leases/new">
            <Button>New lease</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Lease Code</th>
                <th className="px-5 py-2 font-medium">Asset</th>
                <th className="px-5 py-2 font-medium">Lessor</th>
                <th className="px-5 py-2 font-medium">Commencement</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium text-right">ROU NBV</th>
                <th className="px-5 py-2 font-medium text-right">Liability</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => (
                <tr key={lease.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/leases/${lease.id}`} className="font-medium text-edme-blue hover:underline">
                      {lease.lease_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{lease.asset_name}</td>
                  <td className="px-5 py-3">{lease.lessors?.name ?? "—"}</td>
                  <td className="px-5 py-3">{formatDate(lease.commencement_date)}</td>
                  <td className="px-5 py-3"><Badge variant={statusVariant(lease.status)}>{lease.status}</Badge></td>
                  <td className="px-5 py-3 text-right">{lease.current_rou_nbv ? formatCurrency(lease.current_rou_nbv) : "—"}</td>
                  <td className="px-5 py-3 text-right">{lease.current_lease_liability ? formatCurrency(lease.current_lease_liability) : "—"}</td>
                </tr>
              ))}
              {!loading && leases.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No leases yet. Create your first lease to get started.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
