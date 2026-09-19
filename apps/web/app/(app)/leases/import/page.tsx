"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

interface ImportResult {
  created: number;
  errors: { row: number | null; lease_code: string; message: string }[];
}

export default function ImportLeasesPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.postForm<ImportResult>("/leases/import", fd);
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leases" className="text-sm text-edme-blue hover:underline">← Back to leases</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Import leases from Excel</h1>
        <p className="text-sm text-slate-500">
          Bring in many leases at once — including opening balances for leases already running, and their security deposits.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Step 1 — Download the template</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => api.download("/leases/import-template.xlsx", "LeasePro_Import_Template.xlsx")}>
            Download Excel template
          </Button>
          <span className="text-sm text-slate-500">One lease per row. The Instructions sheet explains every column.</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Step 2 — Upload the filled template</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edme-blue/40 bg-white px-4 py-2 text-sm font-medium text-edme-blue shadow-sm hover:bg-edme-blue/10">
            {importing ? "Importing…" : "Choose filled Excel file"}
            <input type="file" accept=".xlsx,.xlsm" className="hidden" disabled={importing} onChange={handleFile} />
          </label>
          {importing && <p className="text-sm text-slate-500">Creating leases and calculating schedules — this can take a moment for many rows…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <span className="font-semibold">{result.created}</span> lease{result.created === 1 ? "" : "s"} imported and calculated
                {result.errors.length > 0 && <span> · <span className="font-semibold text-amber-700">{result.errors.length}</span> row(s) skipped</span>}.
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                  <p className="mb-2 font-medium text-amber-800">Rows that could not be imported:</p>
                  <ul className="space-y-1 text-amber-900">
                    {result.errors.map((err, i) => (
                      <li key={i}>Row {err.row ?? "?"} {err.lease_code && `(${err.lease_code})`}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Link href="/leases" className="inline-block text-sm font-medium text-edme-blue hover:underline">View imported leases →</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
