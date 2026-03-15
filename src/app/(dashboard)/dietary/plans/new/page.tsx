"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewDietPlanPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [form, setForm] = useState({
    patientId: "", dietType: "REGULAR", allergies: "", restrictions: "",
    calories: "", proteinGrams: "", carbGrams: "", fatGrams: "",
    specialInstructions: "", startDate: new Date().toISOString().split("T")[0], endDate: "",
  });

  useEffect(() => {
    fetch("/api/patients?limit=200").then((r) => r.json()).then((d) => setPatients(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      calories: form.calories ? Number(form.calories) : undefined,
      proteinGrams: form.proteinGrams ? Number(form.proteinGrams) : undefined,
      carbGrams: form.carbGrams ? Number(form.carbGrams) : undefined,
      fatGrams: form.fatGrams ? Number(form.fatGrams) : undefined,
    };
    const res = await fetch("/api/dietary/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) router.push("/dietary");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Diet Plan" description="Prescribe a dietary plan for a patient" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Diet Plan Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <Label>Diet Type *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.dietType} onChange={(e) => setForm({ ...form, dietType: e.target.value })}>
                  <option value="REGULAR">Regular</option><option value="DIABETIC">Diabetic</option><option value="LOW_SODIUM">Low Sodium</option>
                  <option value="RENAL">Renal</option><option value="LIQUID">Liquid</option><option value="SOFT">Soft</option>
                  <option value="NPO">NPO (Nothing by Mouth)</option><option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div><Label>Calories (kcal)</Label><Input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} /></div>
              <div><Label>Protein (g)</Label><Input type="number" value={form.proteinGrams} onChange={(e) => setForm({ ...form, proteinGrams: e.target.value })} /></div>
              <div><Label>Carbs (g)</Label><Input type="number" value={form.carbGrams} onChange={(e) => setForm({ ...form, carbGrams: e.target.value })} /></div>
              <div><Label>Fat (g)</Label><Input type="number" value={form.fatGrams} onChange={(e) => setForm({ ...form, fatGrams: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Allergies</Label><Textarea value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g., Nuts, Gluten, Dairy..." /></div>
              <div className="md:col-span-2"><Label>Restrictions</Label><Textarea value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} placeholder="e.g., No spicy food, Low fiber..." /></div>
              <div className="md:col-span-2"><Label>Special Instructions</Label><Textarea value={form.specialInstructions} onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create Plan"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/dietary")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
