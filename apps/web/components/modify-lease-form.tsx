"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { ModificationType } from "@/lib/types";

const MODIFICATION_TYPES: { value: ModificationType; label: string }[] = [
  { value: "TERM_EXTENSION", label: "Term extension" },
  { value: "TERM_REDUCTION", label: "Term reduction" },
  { value: "RATE_CHANGE", label: "Discount rate change" },
  { value: "PRICE_CHANGE", label: "Payment amount change" },
  { value: "SCOPE_DECREASE", label: "Scope decrease (partial termination)" },
  { value: "FULL_TERMINATION", label: "Full termination" },
];

export function ModifyLeaseForm({ leaseId, onModified }: { leaseId: string; onModified: () => void }) {
  const [modificationType, setModificationType] = useState<ModificationType>("TERM_EXTENSION");
  const [modificationDate, setModificationDate] = useState("");
  const [description, setDescription] = useState("");
  const [revisedTermMonths, setRevisedTermMonths] = useState("");
  const [revisedDiscountRate, setRevisedDiscountRate] = useState("");
  const [revisedPaymentAmount, setRevisedPaymentAmount] = useState("");
  const [reductionRatio, setReductionRatio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.post(`/leases/${leaseId}/modify`, {
        modification_date: modificationDate,
        modification_type: modificationType,
        description: description || null,
        revised_term_months: revisedTermMonths ? Number(revisedTermMonths) : null,
        revised_discount_rate: revisedDiscountRate ? Number(revisedDiscountRate) : null,
        revised_payment_amount: revisedPaymentAmount ? Number(revisedPaymentAmount) : null,
        reduction_ratio: reductionRatio ? Number(reductionRatio) : null,
      });
      setSuccess(true);
      onModified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Modification failed");
    } finally {
      setSaving(false);
    }
  }

  const needsReductionRatio = modificationType === "SCOPE_DECREASE";
  const needsRevisedTerms = !needsReductionRatio && modificationType !== "FULL_TERMINATION";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a modification / remeasurement</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="modification_type">Type</Label>
            <Select id="modification_type" value={modificationType} onChange={(e) => setModificationType(e.target.value as ModificationType)}>
              {MODIFICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="modification_date">Effective date</Label>
            <Input id="modification_date" type="date" required value={modificationDate} onChange={(e) => setModificationDate(e.target.value)} />
          </div>
          {needsReductionRatio && (
            <div>
              <Label htmlFor="reduction_ratio">Reduction ratio (0-1)</Label>
              <Input id="reduction_ratio" type="number" step="0.01" min={0} max={1} required value={reductionRatio} onChange={(e) => setReductionRatio(e.target.value)} placeholder="0.30 = 30% reduction" />
            </div>
          )}
          {needsRevisedTerms && (
            <>
              <div>
                <Label htmlFor="revised_term_months">Revised term (months, optional)</Label>
                <Input id="revised_term_months" type="number" value={revisedTermMonths} onChange={(e) => setRevisedTermMonths(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="revised_discount_rate">Revised discount rate (optional)</Label>
                <Input id="revised_discount_rate" type="number" step="0.00001" value={revisedDiscountRate} onChange={(e) => setRevisedDiscountRate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="revised_payment_amount">Revised payment amount (optional)</Label>
                <Input id="revised_payment_amount" type="number" step="0.01" value={revisedPaymentAmount} onChange={(e) => setRevisedPaymentAmount(e.target.value)} />
              </div>
            </>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{error}</p>}
          {success && <p className="text-sm text-emerald-600 sm:col-span-2 lg:col-span-3">Modification recorded and remeasurement journal booked.</p>}
          <div>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record modification"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
