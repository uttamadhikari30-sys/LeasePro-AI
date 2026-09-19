"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import type { Organization } from "@/lib/types";

export default function DiscountRateEnginePage() {
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
        discount_rate_mode: org.discount_rate_mode,
        default_lease_discount_rate: org.default_lease_discount_rate,
        default_deposit_discount_rate: org.default_deposit_discount_rate,
      });
      setOrg(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save discount-rate policy");
    } finally {
      setSaving(false);
    }
  }

  if (!org) return <p className="text-slate-400">Loading…</p>;

  const modes: { value: Organization["discount_rate_mode"]; title: string; desc: string }[] = [
    { value: "PER_LEASE", title: "Per-lease rates", desc: "Each lease carries its own incremental borrowing rate, entered when the lease is created." },
    { value: "UNIFORM", title: "One rate for all leases", desc: "A single group discount rate is applied to every lease. New leases prefill this rate automatically." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Discount Rate Engine</h1>
        <p className="text-sm text-slate-500">
          Control how incremental borrowing rates are applied across leases, and set a separate rate for security deposits.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Rate policy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {modes.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  org.discount_rate_mode === m.value ? "border-edme-blue bg-edme-blue/5" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  className="mt-1"
                  checked={org.discount_rate_mode === m.value}
                  onChange={() => set("discount_rate_mode", m.value)}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                  <p className="text-sm text-slate-500">{m.desc}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Default rates</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="lease-rate">
                Lease discount rate {org.discount_rate_mode === "UNIFORM" ? "(applied to all leases)" : "(default for new leases)"}
              </Label>
              <Input
                id="lease-rate"
                type="number"
                step="0.00001"
                value={org.default_lease_discount_rate}
                onChange={(e) => set("default_lease_discount_rate", e.target.value)}
                placeholder="0.10 = 10%"
              />
              <p className="mt-1 text-xs text-slate-400">Decimal — e.g. 0.10 for 10%. Currently {(parseFloat(org.default_lease_discount_rate || "0") * 100).toFixed(2)}%.</p>
            </div>
            <div>
              <Label htmlFor="deposit-rate">Security-deposit discount rate</Label>
              <Input
                id="deposit-rate"
                type="number"
                step="0.00001"
                value={org.default_deposit_discount_rate}
                onChange={(e) => set("default_deposit_discount_rate", e.target.value)}
                placeholder="0.07 = 7%"
              />
              <p className="mt-1 text-xs text-slate-400">Used to discount refundable deposits to present value. Currently {(parseFloat(org.default_deposit_discount_rate || "0") * 100).toFixed(2)}%.</p>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save policy"}</Button>
          {saved && <span className="text-sm font-medium text-green-700">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
