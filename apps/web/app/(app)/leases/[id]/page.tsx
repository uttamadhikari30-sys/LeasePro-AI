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
  SimulateResponse,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ModifyLeaseForm } from "@/components/modify-lease-form";
import { LeaseMemo } from "@/components/lease-memo";
import { useOrganization, useProfile } from "@/lib/profile-context";
import type { Lessor } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tab = "overview" | "liability" | "rou" | "journals" | "memo" | "whatif" | "modify";

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const org = useOrganization();
  const profile = useProfile();
  const [lease, setLease] = useState<Lease | null>(null);
  const [lessorName, setLessorName] = useState<string | null>(null);
  const [liabilitySchedule, setLiabilitySchedule] = useState<LiabilityScheduleRow[]>([]);
  const [rouSchedule, setRouSchedule] = useState<RouScheduleRow[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatif, setWhatif] = useState({ revised_base_payment: "", revised_term_months: "", revised_discount_rate_annual: "", revised_escalation_percent: "" });
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [simulating, setSimulating] = useState(false);

  function loadAll() {
    api.get<Lease>(`/leases/${id}`).then((l) => {
      setLease(l);
      api.get<Lessor[]>("/lessors")
        .then((list) => setLessorName(list.find((x) => x.id === l.lessor_id)?.name ?? null))
        .catch(() => {});
    });
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

  async function handleUploadAgreement(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingDoc(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.postForm(`/leases/${id}/document`, fd);
      api.get<Lease>(`/leases/${id}`).then(setLease);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload agreement");
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleSimulate() {
    setSimulating(true);
    setError(null);
    try {
      const body: Record<string, number> = {};
      if (whatif.revised_base_payment) body.revised_base_payment = Number(whatif.revised_base_payment);
      if (whatif.revised_term_months) body.revised_term_months = Number(whatif.revised_term_months);
      if (whatif.revised_discount_rate_annual) body.revised_discount_rate_annual = Number(whatif.revised_discount_rate_annual);
      if (whatif.revised_escalation_percent) body.revised_escalation_percent = Number(whatif.revised_escalation_percent);
      const res = await api.post<SimulateResponse>(`/leases/${id}/simulate`, body);
      setSimResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  async function handleViewAgreement() {
    try {
      const { url } = await api.get<{ url: string }>(`/leases/${id}/document`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open agreement");
    }
  }

  if (!lease) return <p className="text-slate-400">Loading…</p>;

  const currentLiability = liabilitySchedule.at(-1);
  const currentRou = rouSchedule.at(-1);

  // Lease lifecycle
  const termMonths = lease.lease_term_months;
  const start = new Date(lease.commencement_date);
  const end = new Date(start);
  end.setMonth(end.getMonth() + termMonths);
  const now = new Date();
  const elapsed = Math.max(0, Math.min(termMonths, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())));
  const pct = termMonths ? Math.round((elapsed / termMonths) * 100) : 0;
  const monthsRemaining = Math.max(0, termMonths - elapsed);
  const standardLabel = org?.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116";
  // Progress ring geometry
  const RR = 34, RC = 2 * Math.PI * RR;

  return (
    <div className="space-y-6">
      {/* Premium lease hero */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-edme-blue-deep via-edme-blue-2 to-edme-blue px-7 py-7 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-edme-red/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "26px 26px" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{lease.lease_code}</h1>
              <Badge variant={statusVariant(lease.status)}>{lease.status}</Badge>
              <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-medium text-white/80">{standardLabel}</span>
            </div>
            <p className="mt-1.5 text-sm text-white/75">{lease.asset_name} · {lease.asset_category}{lease.location ? ` · ${lease.location}` : ""}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 text-white/80"><span className="text-white/45">Commenced</span> <span className="font-medium">{formatDate(lease.commencement_date)}</span></span>
              <span className="flex items-center gap-1.5 text-white/80"><span className="text-white/45">Ends</span> <span className="font-medium">{formatDate(end.toISOString())}</span></span>
              <span className="flex items-center gap-1.5 text-white/80"><span className="text-white/45">Term</span> <span className="font-medium">{termMonths} months</span></span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handleCalculate} disabled={calculating} className="bg-white text-edme-blue hover:bg-white/90">
                {calculating ? "Calculating…" : liabilitySchedule.length ? "Recalculate" : "Calculate schedules"}
              </Button>
              <button onClick={() => setTab("memo")} className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
                Accounting memo
              </button>
            </div>
          </div>
          {/* Lifecycle ring */}
          <div className="relative hidden shrink-0 sm:block">
            <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
              <circle cx="46" cy="46" r={RR} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle cx="46" cy="46" r={RR} fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * RC} ${RC}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{pct}%</span>
              <span className="text-[8px] font-semibold uppercase tracking-wider text-white/60">Elapsed</span>
            </div>
            <p className="mt-2 text-center text-xs text-white/60">{monthsRemaining} mo remaining</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Metric tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "LEASE LIABILITY", value: currentLiability ? formatCurrency(currentLiability.closing_liability, lease.currency) : "—", dot: "bg-edme-red", sub: "Current carrying amount" },
          { label: "ROU ASSET NBV", value: currentRou ? formatCurrency(currentRou.closing_nbv, lease.currency) : "—", dot: "bg-edme-blue", sub: "Net book value" },
          { label: "DISCOUNT RATE", value: `${(parseFloat(lease.discount_rate_annual) * 100).toFixed(2)}%`, dot: "bg-violet-500", sub: lease.payment_timing === "ADVANCE" ? "Payable in advance" : "Payable in arrears" },
          { label: "PAYMENT", value: `${formatCurrency(lease.base_payment_amount, lease.currency)}`, dot: "bg-emerald-500", sub: `per ${lease.payment_frequency.toLowerCase()}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{s.value}</p>
            <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {(["overview", "liability", "rou", "journals", "memo", "whatif", "modify"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-edme-blue text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {t === "rou" ? "ROU Schedule" : t === "liability" ? "Liability Schedule" : t === "whatif" ? "What-If" : t === "memo" ? "Accounting Memo" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
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

          <Card>
            <CardHeader><CardTitle>Lease agreement</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {lease.agreement_filename ? (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs">{lease.agreement_filename}</span>
                  <button onClick={handleViewAgreement} className="font-medium text-edme-blue hover:underline">View</button>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No agreement attached yet.</p>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edme-blue/40 bg-white px-4 py-2 text-sm font-medium text-edme-blue shadow-sm hover:bg-edme-blue/10">
                {uploadingDoc ? "Uploading…" : lease.agreement_filename ? "Replace" : "Upload agreement"}
                <input type="file" accept="application/pdf,image/png,image/jpeg,.doc,.docx" className="hidden" disabled={uploadingDoc} onChange={handleUploadAgreement} />
              </label>
              <span className="text-xs text-slate-400">PDF, Word or image · max 25 MB</span>
            </CardContent>
          </Card>
        </div>
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

      {tab === "memo" && (
        <LeaseMemo
          lease={lease}
          org={org}
          profile={profile}
          liability={liabilitySchedule}
          rou={rouSchedule}
          journals={journals}
          lessorName={lessorName}
        />
      )}

      {tab === "whatif" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>What-If simulator</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Model a scenario against the current lease terms. Nothing is saved — leave a field blank to keep the current value.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="w_pay">Revised payment / period</Label>
                  <Input id="w_pay" type="number" step="0.01" value={whatif.revised_base_payment} onChange={(e) => setWhatif({ ...whatif, revised_base_payment: e.target.value })} placeholder={lease.base_payment_amount} />
                </div>
                <div>
                  <Label htmlFor="w_term">Revised term (months)</Label>
                  <Input id="w_term" type="number" value={whatif.revised_term_months} onChange={(e) => setWhatif({ ...whatif, revised_term_months: e.target.value })} placeholder={String(lease.lease_term_months)} />
                </div>
                <div>
                  <Label htmlFor="w_rate">Revised discount rate</Label>
                  <Input id="w_rate" type="number" step="0.00001" value={whatif.revised_discount_rate_annual} onChange={(e) => setWhatif({ ...whatif, revised_discount_rate_annual: e.target.value })} placeholder={lease.discount_rate_annual} />
                </div>
                <div>
                  <Label htmlFor="w_esc">Revised escalation %</Label>
                  <Input id="w_esc" type="number" step="0.001" value={whatif.revised_escalation_percent} onChange={(e) => setWhatif({ ...whatif, revised_escalation_percent: e.target.value })} placeholder={lease.escalation_percent} />
                </div>
              </div>
              <Button onClick={handleSimulate} disabled={simulating}>{simulating ? "Simulating…" : "Run simulation"}</Button>
            </CardContent>
          </Card>

          {simResult && (
            <Card>
              <CardHeader><CardTitle>Impact</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-2 font-medium">Measure</th>
                      <th className="px-5 py-2 font-medium text-right">Current</th>
                      <th className="px-5 py-2 font-medium text-right">Scenario</th>
                      <th className="px-5 py-2 font-medium text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["Lease liability (initial)", simResult.base.lease_liability, simResult.scenario.lease_liability, simResult.liability_delta],
                      ["ROU asset (initial)", simResult.base.rou_asset, simResult.scenario.rou_asset, simResult.rou_delta],
                      ["Total payments", simResult.base.total_payments, simResult.scenario.total_payments, String(Number(simResult.scenario.total_payments) - Number(simResult.base.total_payments))],
                      ["Total interest", simResult.base.total_interest, simResult.scenario.total_interest, String(Number(simResult.scenario.total_interest) - Number(simResult.base.total_interest))],
                    ] as [string, string, string, string][]).map(([label, cur, scn, delta]) => {
                      const d = Number(delta);
                      return (
                        <tr key={label} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 text-slate-700">{label}</td>
                          <td className="px-5 py-3 text-right">{formatCurrency(cur, lease.currency)}</td>
                          <td className="px-5 py-3 text-right font-medium">{formatCurrency(scn, lease.currency)}</td>
                          <td className={`px-5 py-3 text-right font-medium ${d > 0 ? "text-edme-red" : d < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {d > 0 ? "+" : ""}{formatCurrency(delta, lease.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
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
