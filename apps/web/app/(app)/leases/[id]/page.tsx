"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type {
  CalculateLeaseResponse,
  JournalEntry,
  Lease,
  LiabilityScheduleRow,
  RouScheduleRow,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ModifyLeaseForm } from "@/components/modify-lease-form";

type Tab = "overview" | "liability" | "rou" | "journals" | "modify";

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lease, setLease] = useState<Lease | null>(null);
  const [liabilitySchedule, setLiabilitySchedule] = useState<LiabilityScheduleRow[]>([]);
  const [rouSchedule, setRouSchedule] = useState<RouScheduleRow[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadAll() {
    api.get<Lease>(`/leases/${id}`).then(setLease);
    api.get<LiabilityScheduleRow[]>(`/leases/${id}/liability-schedule`).then(setLiabilitySchedule);
    api.get<RouScheduleRow[]>(`/leases/${id}/rou-schedule`).then(setRouSchedule);
    api.get<JournalEntry[]>(`/leases/${id}/journals`).then(setJournals);
  }

  useEffect(loadAll, [id]);

  async function handleCalculate() {
    setCalculating(true);
    setError(null);
    try {
      await api.post<CalculateLeaseResponse>(`/leases/${id}/calculate`, { payment_overrides: [] });
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }

  async function handleGenerateJournals() {
    setGenerating(true);
    setGenerateMsg(null);
    setError(null);
    try {
      const res = await api.post<{ total_entries: number }>(`/leases/${id}/journals/generate-all`);
      setGenerateMsg(`Generated ${res.total_entries} journal entries.`);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate journal entries");
    } finally {
      setGenerating(false);
    }
  }

  if (!lease) return <p className="text-slate-400">Loading…</p>;

  const currentLiability = liabilitySchedule.at(-1);
  const currentRou = rouSchedule.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lease.lease_code}</h1>
            <Badge variant={statusVariant(lease.status)}>{lease.status}</Badge>
          </div>
          <p className="text-sm text-slate-500">{lease.asset_name} &middot; {lease.asset_category}</p>
        </div>
        <Button onClick={handleCalculate} disabled={calculating}>
          {calculating ? "Calculating…" : liabilitySchedule.length ? "Recalculate" : "Calculate schedules"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Lease liability (current)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{currentLiability ? formatCurrency(currentLiability.closing_liability) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>ROU asset NBV (current)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{currentRou ? formatCurrency(currentRou.closing_nbv) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Discount rate</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-semibold">{(parseFloat(lease.discount_rate_annual) * 100).toFixed(2)}%</p></CardContent>
        </Card>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["overview", "liability", "rou", "journals", "modify"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-edme-blue text-edme-blue" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "rou" ? "ROU Schedule" : t === "liability" ? "Liability Schedule" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 py-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Commencement date" value={formatDate(lease.commencement_date)} />
            <Field label="Lease term" value={`${lease.lease_term_months} months`} />
            <Field label="Payment" value={`${formatCurrency(lease.base_payment_amount, lease.currency)} / ${lease.payment_frequency.toLowerCase()}`} />
            <Field label="Payment timing" value={lease.payment_timing} />
            <Field label="Escalation" value={lease.escalation_type === "NONE" ? "None" : `${lease.escalation_percent}% every ${lease.escalation_frequency_months}mo`} />
            <Field label="Initial direct costs" value={formatCurrency(lease.initial_direct_costs, lease.currency)} />
            <Field label="Lease incentives" value={formatCurrency(lease.lease_incentives, lease.currency)} />
            <Field label="Restoration cost estimate" value={formatCurrency(lease.restoration_cost_estimate, lease.currency)} />
            <Field label="Short-term exemption" value={lease.is_short_term ? "Yes" : "No"} />
            <Field label="Low-value exemption" value={lease.is_low_value ? "Yes" : "No"} />
          </CardContent>
        </Card>
      )}

      {tab === "liability" && (
        <ScheduleTable
          headers={["#", "Period start", "Period end", "Opening", "Interest", "Payment", "Closing"]}
          rows={liabilitySchedule.map((r) => [
            r.period_number,
            formatDate(r.period_start),
            formatDate(r.period_end),
            formatCurrency(r.opening_liability, lease.currency),
            formatCurrency(r.interest_expense, lease.currency),
            formatCurrency(r.payment, lease.currency),
            formatCurrency(r.closing_liability, lease.currency),
          ])}
        />
      )}

      {tab === "rou" && (
        <ScheduleTable
          headers={["#", "Period start", "Period end", "Opening NBV", "Depreciation", "Impairment", "Closing NBV"]}
          rows={rouSchedule.map((r) => [
            r.period_number,
            formatDate(r.period_start),
            formatDate(r.period_end),
            formatCurrency(r.opening_nbv, lease.currency),
            formatCurrency(r.depreciation, lease.currency),
            formatCurrency(r.impairment, lease.currency),
            formatCurrency(r.closing_nbv, lease.currency),
          ])}
        />
      )}

      {tab === "journals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-edme-blue/20 bg-edme-blue/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Monthly auto accounting entries</p>
              <p className="text-xs text-slate-500">
                Books initial recognition, every period&apos;s interest, payment &amp; ROU depreciation, plus security-deposit
                unwinding — regenerated from the computed schedules.
              </p>
              {generateMsg && <p className="mt-1 text-xs font-medium text-green-700">{generateMsg}</p>}
            </div>
            <Button onClick={handleGenerateJournals} disabled={generating || !liabilitySchedule.length}>
              {generating ? "Generating…" : "Generate all entries"}
            </Button>
          </div>
          {journals.length === 0 && <p className="text-slate-400">No journal entries yet. Calculate the lease, then generate the monthly entries above.</p>}
          {journals.map((j) => (
            <Card key={j.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{j.entry_type.replace(/_/g, " ")} &middot; {formatDate(j.entry_date)}</CardTitle>
                <Badge>{j.status}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-2 font-medium">Account</th>
                      <th className="px-5 py-2 font-medium text-right">Debit</th>
                      <th className="px-5 py-2 font-medium text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.lines.map((line, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-2">{line.account_name}</td>
                        <td className="px-5 py-2 text-right">{parseFloat(line.debit) ? formatCurrency(line.debit, lease.currency) : ""}</td>
                        <td className="px-5 py-2 text-right">{parseFloat(line.credit) ? formatCurrency(line.credit, lease.currency) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "modify" && <ModifyLeaseForm leaseId={lease.id} onModified={loadAll} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ScheduleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
            <tr>
              {headers.map((h) => <th key={h} className="px-5 py-2 font-medium whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-50 last:border-0">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className={`px-5 py-2 whitespace-nowrap ${cellIdx > 2 ? "text-right" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-slate-400">No schedule yet. Click &quot;Calculate schedules&quot; above.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
