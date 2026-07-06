"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [reportingStandard, setReportingStandard] = useState("IND_AS_116");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If this user already has an organization, skip straight to the dashboard.
    api
      .get("/organizations/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/organizations/bootstrap", {
        organization_name: orgName,
        full_name: fullName,
        reporting_standard: reportingStandard,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to set up organization");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">LeasePro AI</h1>
          <p className="mt-1 text-sm text-slate-500">One last step &mdash; set up your organization</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <Label htmlFor="orgName">Organization name</Label>
            <Input id="orgName" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Industries Pvt Ltd" />
          </div>
          <div>
            <Label htmlFor="reportingStandard">Reporting standard</Label>
            <Select id="reportingStandard" value={reportingStandard} onChange={(e) => setReportingStandard(e.target.value)}>
              <option value="IND_AS_116">Ind AS 116</option>
              <option value="IFRS_16">IFRS 16</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fullName">Your full name</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Setting up..." : "Create organization"}
          </Button>
        </form>
      </div>
    </div>
  );
}
