"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import { formatDate } from "@/lib/utils";

interface AuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  CALCULATE: "bg-violet-50 text-violet-700",
  GENERATE_JOURNALS: "bg-amber-50 text-amber-700",
  MODIFY: "bg-orange-50 text-orange-700",
};

export default function AuditTrailPage() {
  const router = useRouter();
  const profile = useProfile();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditLogRow[]>("/reports/audit-trail?limit=300").then(setRows).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [profile, router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500">Every create, update and calculation across the organization, most recent first.</p>
      </div>

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
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-600">{formatDate(r.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[r.action] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.action.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-700">{r.entity_type.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No activity recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
