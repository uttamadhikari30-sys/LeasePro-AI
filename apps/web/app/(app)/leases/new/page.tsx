"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Lease, LeaseExtractionResponse, Lessor, Organization } from "@/lib/types";

const initialForm = {
  lessor_id: "",
  lease_code: "",
  asset_name: "",
  asset_category: "Property",
  location: "",
  commencement_date: "",
  lease_term_months: 36,
  non_cancellable_period_months: 36,
  renewal_option_months: 0,
  reasonably_certain_to_renew: false,
  termination_option_months: 0,
  reasonably_certain_to_terminate_early: false,
  payment_frequency: "MONTHLY",
  payment_timing: "ARREARS",
  base_payment_amount: "",
  escalation_type: "NONE",
  escalation_percent: "0",
  escalation_frequency_months: 12,
  discount_rate_annual: "0.10",
  currency: "INR",
  initial_direct_costs: "0",
  lease_incentives: "0",
  restoration_cost_estimate: "0",
  prepaid_rent: "0",
  is_short_term: false,
  is_low_value: false,
  useful_life_months: "",
  gst_applicable: false,
  gst_rate: "0",
  tds_applicable: false,
  tds_rate: "0",
  notes: "",
};

export default function NewLeasePage() {
  const router = useRouter();
  const [lessors, setLessors] = useState<Lessor[]>([]);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [unmatchedLessorName, setUnmatchedLessorName] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    api.get<Lessor[]>("/lessors").then(setLessors);
    api.get<Organization>("/organizations/me").then((o) => {
      setOrg(o);
      // Apply the discount-rate policy: prefill the lease rate from the org
      // default (and lock it when the policy is a single uniform rate).
      setForm((f) => ({ ...f, discount_rate_annual: o.default_lease_discount_rate }));
    });
  }, []);

  const uniformRate = org?.discount_rate_mode === "UNIFORM";

  function set<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleExtractFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setExtracting(true);
    setExtractError(null);
    setExtractWarnings([]);
    setUnmatchedLessorName(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.postForm<LeaseExtractionResponse>("/ai/extract-lease", formData);
      const f = result.fields;

      setForm((prev) => ({
        ...prev,
        asset_name: f.asset_name ?? prev.asset_name,
        asset_category: f.asset_category ?? prev.asset_category,
        location: f.location ?? prev.location,
        commencement_date: f.commencement_date ?? prev.commencement_date,
        lease_term_months: f.lease_term_months ?? prev.lease_term_months,
        non_cancellable_period_months: f.non_cancellable_period_months ?? prev.non_cancellable_period_months,
        renewal_option_months: f.renewal_option_months ?? prev.renewal_option_months,
        payment_frequency: f.payment_frequency ?? prev.payment_frequency,
        payment_timing: f.payment_timing ?? prev.payment_timing,
        base_payment_amount: f.base_payment_amount ?? prev.base_payment_amount,
        escalation_type: f.escalation_type ?? prev.escalation_type,
        escalation_percent: f.escalation_percent ?? prev.escalation_percent,
        escalation_frequency_months: f.escalation_frequency_months ?? prev.escalation_frequency_months,
        currency: f.currency ?? prev.currency,
        notes: f.notes ?? prev.notes,
      }));

      if (f.lessor_name) {
        const match = lessors.find((l) => l.name.toLowerCase().trim() === f.lessor_name!.toLowerCase().trim());
        if (match) {
          set("lessor_id", match.id);
        } else {
          setUnmatchedLessorName(f.lessor_name);
        }
      }

      setExtractWarnings(result.warnings);
    } catch (err) {
      setExtractError(err instanceof ApiError ? err.message : "Failed to extract lease terms from this document");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        useful_life_months: form.useful_life_months ? Number(form.useful_life_months) : null,
      };
      const lease = await api.post<Lease>("/leases", payload);
      router.push(`/leases/${lease.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lease");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New lease</h1>
        <p className="text-sm text-slate-500">Enter the contract terms; the Ind AS 116 / IFRS 16 schedules are computed after saving.</p>
      </div>

      <Card className="border-edme-blue/20 bg-edme-blue/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden>✨</span> Auto-fill from a lease document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Upload a lease agreement (PDF or scanned image) and AI will read it and pre-fill the fields below. Always
            review the extracted values before saving.
          </p>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edme-blue/40 bg-white px-4 py-2 text-sm font-medium text-edme-blue shadow-sm hover:bg-edme-blue/10">
              {extracting ? "Reading document…" : "Choose file"}
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={extracting}
                onChange={handleExtractFile}
              />
            </label>
            {extracting && <span className="text-sm text-slate-500">This can take up to a minute for long contracts…</span>}
          </div>
          {extractError && <p className="text-sm text-red-600">{extractError}</p>}
          {unmatchedLessorName && (
            <p className="text-sm text-amber-700">
              Lessor "{unmatchedLessorName}" was found in the document but doesn't match any existing lessor — add them
              in the Lessors section first, then select manually below.
            </p>
          )}
          {extractWarnings.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
              {extractWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Basic details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="lessor_id">Lessor</Label>
              <Select id="lessor_id" required value={form.lessor_id} onChange={(e) => set("lessor_id", e.target.value)}>
                <option value="">Select lessor…</option>
                {lessors.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="lease_code">Lease code</Label>
              <Input id="lease_code" required value={form.lease_code} onChange={(e) => set("lease_code", e.target.value)} placeholder="LSE-2026-001" />
            </div>
            <div>
              <Label htmlFor="asset_category">Asset category</Label>
              <Select id="asset_category" value={form.asset_category} onChange={(e) => set("asset_category", e.target.value)}>
                {["Property", "Vehicle", "Plant & Machinery", "IT Equipment", "Furniture", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="asset_name">Asset / premises name</Label>
              <Input id="asset_name" required value={form.asset_name} onChange={(e) => set("asset_name", e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Term & payments</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="commencement_date">Commencement date</Label>
              <Input id="commencement_date" type="date" required value={form.commencement_date} onChange={(e) => set("commencement_date", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lease_term_months">Lease term (months)</Label>
              <Input id="lease_term_months" type="number" required min={1} value={form.lease_term_months} onChange={(e) => set("lease_term_months", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="non_cancellable_period_months">Non-cancellable period (months)</Label>
              <Input id="non_cancellable_period_months" type="number" required min={0} value={form.non_cancellable_period_months} onChange={(e) => set("non_cancellable_period_months", Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="payment_frequency">Payment frequency</Label>
              <Select id="payment_frequency" value={form.payment_frequency} onChange={(e) => set("payment_frequency", e.target.value)}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half-yearly</option>
                <option value="ANNUALLY">Annually</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_timing">Payment timing</Label>
              <Select id="payment_timing" value={form.payment_timing} onChange={(e) => set("payment_timing", e.target.value)}>
                <option value="ARREARS">Arrears (end of period)</option>
                <option value="ADVANCE">Advance (start of period)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="base_payment_amount">Base payment per period</Label>
              <Input id="base_payment_amount" type="number" step="0.01" required value={form.base_payment_amount} onChange={(e) => set("base_payment_amount", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="escalation_type">Escalation</Label>
              <Select id="escalation_type" value={form.escalation_type} onChange={(e) => set("escalation_type", e.target.value)}>
                <option value="NONE">None</option>
                <option value="FIXED_PERCENT">Fixed %</option>
              </Select>
            </div>
            {form.escalation_type === "FIXED_PERCENT" && (
              <>
                <div>
                  <Label htmlFor="escalation_percent">Escalation %</Label>
                  <Input id="escalation_percent" type="number" step="0.001" value={form.escalation_percent} onChange={(e) => set("escalation_percent", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="escalation_frequency_months">Escalation every (months)</Label>
                  <Input id="escalation_frequency_months" type="number" min={1} value={form.escalation_frequency_months} onChange={(e) => set("escalation_frequency_months", Number(e.target.value))} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Discount rate & initial costs</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="discount_rate_annual">Incremental borrowing rate (annual, decimal)</Label>
              <Input id="discount_rate_annual" type="number" step="0.00001" required value={form.discount_rate_annual} onChange={(e) => set("discount_rate_annual", e.target.value)} placeholder="0.10 = 10%" disabled={uniformRate} />
              {uniformRate && (
                <p className="mt-1 text-xs text-slate-400">
                  Set by the Discount Rate Engine (uniform rate for all leases).
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" required value={form.currency} onChange={(e) => set("currency", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="useful_life_months">Useful life (months, optional)</Label>
              <Input id="useful_life_months" type="number" value={form.useful_life_months} onChange={(e) => set("useful_life_months", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="initial_direct_costs">Initial direct costs</Label>
              <Input id="initial_direct_costs" type="number" step="0.01" value={form.initial_direct_costs} onChange={(e) => set("initial_direct_costs", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lease_incentives">Lease incentives received</Label>
              <Input id="lease_incentives" type="number" step="0.01" value={form.lease_incentives} onChange={(e) => set("lease_incentives", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="restoration_cost_estimate">Restoration cost estimate</Label>
              <Input id="restoration_cost_estimate" type="number" step="0.01" value={form.restoration_cost_estimate} onChange={(e) => set("restoration_cost_estimate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="prepaid_rent">Prepaid rent (paid before commencement)</Label>
              <Input id="prepaid_rent" type="number" step="0.01" value={form.prepaid_rent} onChange={(e) => set("prepaid_rent", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Exemptions & tax</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_short_term} onChange={(e) => set("is_short_term", e.target.checked)} />
              Short-term exemption
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_low_value} onChange={(e) => set("is_low_value", e.target.checked)} />
              Low-value exemption
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.gst_applicable} onChange={(e) => set("gst_applicable", e.target.checked)} />
              GST applicable
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.tds_applicable} onChange={(e) => set("tds_applicable", e.target.checked)} />
              TDS applicable
            </label>
            {form.gst_applicable && (
              <div>
                <Label htmlFor="gst_rate">GST rate (%)</Label>
                <Input id="gst_rate" type="number" step="0.01" value={form.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} />
              </div>
            )}
            {form.tds_applicable && (
              <div>
                <Label htmlFor="tds_rate">TDS rate (%)</Label>
                <Input id="tds_rate" type="number" step="0.01" value={form.tds_rate} onChange={(e) => set("tds_rate", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-edme-blue"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save lease"}</Button>
        </div>
      </form>
    </div>
  );
}
