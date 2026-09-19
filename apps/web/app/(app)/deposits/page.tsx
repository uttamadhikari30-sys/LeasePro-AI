"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Deposit {
  id: string;
  deposit_amount: string;
  present_value: string;
  prepaid_rent_component: string;
  paid_date: string;
  expected_refund_date: string;
  refundable: boolean;
}

interface LeaseDeposits {
  id: string;
  lease_code: string;
  asset_name: string;
  deposits: Deposit[];
}

export default function DepositsPage() {
  const [rows, setRows] = useState<LeaseDeposits[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<LeaseDeposits[]>("/reports/security-deposit-register").then(setRows).finally(() => setLoading(false));
  }, []);

  const allDeposits = rows.flatMap((r) => r.deposits.map((d) => ({ ...d, lease: r })));
  const totalFace = allDeposits.reduce((s, d) => s + parseFloat(d.deposit_amount), 0);
  const totalPv = allDeposits.reduce((s, d) => s + parseFloat(d.present_value), 0);
  const totalPrepaid = allDeposits.reduce((s, d) => s + parseFloat(d.prepaid_rent_component), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security Deposits</h1>
        <p className="text-sm text-slate-500">
          Refundable deposits recognised at present value (Ind AS 109 / IFRS 9), with the day-1 discount as prepaid rent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Total deposit (face value)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalFace)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recognised at present value</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalPv)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Prepaid rent (day-1 discount)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalPrepaid)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All security deposits</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Lease</th>
                <th className="px-5 py-2 font-medium">Paid</th>
                <th className="px-5 py-2 font-medium text-right">Face value</th>
                <th className="px-5 py-2 font-medium text-right">Present value</th>
                <th className="px-5 py-2 font-medium text-right">Prepaid rent</th>
                <th className="px-5 py-2 font-medium">Refund due</th>
              </tr>
            </thead>
            <tbody>
              {allDeposits.map((d) => (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/leases/${d.lease.id}`} className="font-medium text-edme-blue hover:underline">
                      {d.lease.lease_code}
                    </Link>
                    <span className="ml-2 text-slate-400">{d.lease.asset_name}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(d.paid_date)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(d.deposit_amount)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(d.present_value)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(d.prepaid_rent_component)}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(d.expected_refund_date)}</td>
                </tr>
              ))}
              {!loading && allDeposits.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No security deposits yet. Add one from a lease&apos;s detail page.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
