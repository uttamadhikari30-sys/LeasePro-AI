"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { DisclosureSummary } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type Tab = "disclosures" | "rou-register" | "liability-rollforward" | "security-deposits" | "audit-trail";

interface RegisterEntry {
  id: string;
  lease_code: string;
  asset_name: string;
  schedule?: Record<string, unknown>[];
  deposits?: Record<string, unknown>[];
}

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("disclosures");
  const [disclosures, setDisclosures] = useState<DisclosureSummary | null>(null);
  const [rouRegister, setRouRegister] = useState<RegisterEntry[]>([]);
  const [liabilityRollforward, setLiabilityRollforward] = useState<RegisterEntry[]>([]);
  const [depositRegister, setDepositRegister] = useState<RegisterEntry[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    api.get<DisclosureSummary>("/reports/disclosures").then(setDisclosures);
    api.get<RegisterEntry[]>("/reports/rou-register").then(setRouRegister);
    api.get<RegisterEntry[]>("/reports/liability-rollforward").then(setLiabilityRollforward);
    api.get<RegisterEntry[]>("/reports/security-deposit-register").then(setDepositRegister);
    api.get<AuditLogRow[]>("/reports/audit-trail").then(setAuditTrail);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Disclosures</h1>
        <p className="text-sm text-slate-500">Ind AS 116 / IFRS 16 disclosure notes and registers.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {([
          ["disclosures", "Disclosures"],
          ["rou-register", "ROU Register"],
          ["liability-rollforward", "Liability Rollforward"],
          ["security-deposits", "Security Deposits"],
          ["audit-trail", "Audit Trail"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === value ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "disclosures" && disclosures && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Total ROU asset (NBV)</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-semibold">{formatCurrency(disclosures.total_rou_asset_nbv)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Total lease liability</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-semibold">{formatCurrency(disclosures.total_lease_liability)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Total cash outflow (YTD)</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-semibold">{formatCurrency(disclosures.total_cash_outflow_ytd)}</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Maturity analysis of undiscounted lease payments</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {disclosures.maturity_analysis.map((b) => (
                    <tr key={b.label} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2">{b.label}</td>
                      <td className="px-5 py-2 text-right font-medium">{formatCurrency(b.undiscounted_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "rou-register" && (
        <div className="space-y-4">
          {rouRegister.map((lease) => (
            <Card key={lease.id}>
              <CardHeader><CardTitle>{lease.lease_code} &middot; {lease.asset_name}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <RegisterScheduleTable rows={lease.schedule ?? []} kind="rou" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "liability-rollforward" && (
        <div className="space-y-4">
          {liabilityRollforward.map((lease) => (
            <Card key={lease.id}>
              <CardHeader><CardTitle>{lease.lease_code} &middot; {lease.asset_name}</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <RegisterScheduleTable rows={lease.schedule ?? []} kind="liability" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "security-deposits" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">Lease</th>
                  <th className="px-5 py-2 font-medium text-right">Deposit</th>
                  <th className="px-5 py-2 font-medium text-right">Present Value</th>
                </tr>
              </thead>
              <tbody>
                {depositRegister.flatMap((lease) =>
                  (lease.deposits ?? []).map((d, idx) => (
                    <tr key={`${lease.id}-${idx}`} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2">{lease.lease_code}</td>
                      <td className="px-5 py-2 text-right">{formatCurrency(String(d.deposit_amount))}</td>
                      <td className="px-5 py-2 text-right">{formatCurrency(String(d.present_value))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "audit-trail" && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">When</th>
                  <th className="px-5 py-2 font-medium">Action</th>
                  <th className="px-5 py-2 font-medium">Entity</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2">{new Date(row.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-2">{row.action}</td>
                    <td className="px-5 py-2">{row.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RegisterScheduleTable({ rows, kind }: { rows: Record<string, unknown>[]; kind: "rou" | "liability" }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-slate-400">Not calculated yet.</p>;
  const headers = kind === "rou"
    ? ["#", "Period end", "Opening NBV", "Depreciation", "Closing NBV"]
    : ["#", "Period end", "Opening", "Interest", "Payment", "Closing"];
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
        <tr>{headers.map((h) => <th key={h} className="px-5 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} className="border-b border-slate-50 last:border-0">
            {kind === "rou" ? (
              <>
                <td className="px-5 py-2">{String(r.period_number)}</td>
                <td className="px-5 py-2">{formatDate(String(r.period_end))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.opening_nbv))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.depreciation))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.closing_nbv))}</td>
              </>
            ) : (
              <>
                <td className="px-5 py-2">{String(r.period_number)}</td>
                <td className="px-5 py-2">{formatDate(String(r.period_end))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.opening_liability))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.interest_expense))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.payment))}</td>
                <td className="px-5 py-2 text-right">{formatCurrency(String(r.closing_liability))}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
