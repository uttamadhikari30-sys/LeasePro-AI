"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import type { Organization } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompanyMasterPage() {
  const router = useRouter();
  const profile = useProfile();
  const [org, setOrg] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Organization>("/organizations/me").then(setOrg);
  }, []);

  useEffect(() => {
    if (profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [profile, router]);

  function set<K extends keyof Organization>(key: K, value: Organization[K]) {
    setOrg((o) => (o ? { ...o, [key]: value } : o));
    setSaved(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Organization>("/organizations/me", {
        name: org.name,
        cin: org.cin,
        gstin: org.gstin,
        functional_currency: org.functional_currency,
        fiscal_year_start_month: org.fiscal_year_start_month,
        low_value_asset_threshold: org.low_value_asset_threshold,
        short_term_threshold_months: org.short_term_threshold_months,
      });
      setOrg(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save company details");
    } finally {
      setSaving(false);
    }
  }

  if (!org) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Company Master</h1>
        <p className="text-sm text-slate-500">Your organization&apos;s statutory and accounting-policy defaults.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Entity details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" required value={org.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cin">CIN</Label>
              <Input id="cin" value={org.cin ?? ""} onChange={(e) => set("cin", e.target.value)} placeholder="Corporate Identity Number" />
            </div>
            <div>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" value={org.gstin ?? ""} onChange={(e) => set("gstin", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Accounting policy defaults</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="currency">Functional currency</Label>
              <Input id="currency" required value={org.functional_currency} onChange={(e) => set("functional_currency", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fy">Fiscal year start month</Label>
              <Select id="fy" value={org.fiscal_year_start_month} onChange={(e) => set("fiscal_year_start_month", Number(e.target.value))}>
                {MONTHS.map((mo, i) => <option key={mo} value={i + 1}>{mo}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="lowvalue">Low-value asset threshold</Label>
              <Input id="lowvalue" type="number" step="0.01" value={org.low_value_asset_threshold} onChange={(e) => set("low_value_asset_threshold", e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">Leases of assets below this value are exempt (expensed straight-line).</p>
            </div>
            <div>
              <Label htmlFor="shortterm">Short-term threshold (months)</Label>
              <Input id="shortterm" type="number" value={org.short_term_threshold_months} onChange={(e) => set("short_term_threshold_months", Number(e.target.value))} />
              <p className="mt-1 text-xs text-slate-400">Leases with a term at or below this are short-term exempt (typically 12).</p>
            </div>
            <div>
              <Label>Reporting standard</Label>
              <Input value={org.reporting_standard === "IFRS_16" ? "IFRS 16" : "Ind AS 116"} disabled />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save company details"}</Button>
          {saved && <span className="text-sm font-medium text-green-700">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
