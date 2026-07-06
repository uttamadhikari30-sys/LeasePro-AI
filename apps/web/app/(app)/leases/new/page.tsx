"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { Lease, Lessor } from "@/lib/types";

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

  useEffect(() => {
    api.get<Lessor[]>("/lessors").then(setLessors);
  }, []);

  function set<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
              <Input id="discount_rate_annual" type="number" step="0.00001" required value={form.discount_rate_annual} onChange={(e) => set("discount_rate_annual", e.target.value)} placeholder="0.10 = 10%" />
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
