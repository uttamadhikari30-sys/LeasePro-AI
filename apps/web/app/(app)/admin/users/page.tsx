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
import type { Profile, UserCreateResponse, UserRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const emptyForm = { email: "", full_name: "", role: "VIEWER" as UserRole };

export default function AdminUsersPage() {
  const router = useRouter();
  const profile = useProfile();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<UserCreateResponse | null>(null);

  function load() {
    setLoading(true);
    api.get<Profile[]>("/organizations/users").then(setUsers).finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [profile, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const result = await api.post<UserCreateResponse>("/organizations/users", form);
      setCreated(result);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">
          There is no public signup — only an organization admin can create new users here.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add user</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                <option value="ADMIN">Admin</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="APPROVER">Approver</option>
                <option value="VIEWER">Viewer</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
            {created && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm sm:col-span-3">
                <p className="font-medium text-emerald-800">
                  {created.full_name} created. Share these sign-in details with them directly — this password won&apos;t be shown again:
                </p>
                <p className="mt-2 font-mono text-emerald-900">
                  {created.email} / {created.temporary_password}
                </p>
              </div>
            )}
            <div>
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create user"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">Role</th>
                <th className="px-5 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{u.full_name || "—"}</td>
                  <td className="px-5 py-3">{u.role}</td>
                  <td className="px-5 py-3">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
