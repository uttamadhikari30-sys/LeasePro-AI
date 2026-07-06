"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Lessor } from "@/lib/types";

const emptyForm = { name: "", gstin: "", pan: "", contact_name: "", contact_email: "", contact_phone: "", address: "" };

export default function LessorsPage() {
  const [lessors, setLessors] = useState<Lessor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get<Lessor[]>("/lessors").then(setLessors).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/lessors", form);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lessor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lessor Master</h1>
        <p className="text-sm text-slate-500">Landlords and leasing counterparties.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add lessor</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="contact_name">Contact name</Label>
              <Input id="contact_name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="contact_email">Contact email</Label>
              <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="contact_phone">Contact phone</Label>
              <Input id="contact_phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{error}</p>}
            <div>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add lessor"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All lessors</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-2 font-medium">Name</th>
                <th className="px-5 py-2 font-medium">GSTIN</th>
                <th className="px-5 py-2 font-medium">Contact</th>
                <th className="px-5 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {lessors.map((lessor) => (
                <tr key={lessor.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{lessor.name}</td>
                  <td className="px-5 py-3">{lessor.gstin || "—"}</td>
                  <td className="px-5 py-3">{lessor.contact_name || "—"}</td>
                  <td className="px-5 py-3">{lessor.contact_email || "—"}</td>
                </tr>
              ))}
              {!loading && lessors.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No lessors yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
