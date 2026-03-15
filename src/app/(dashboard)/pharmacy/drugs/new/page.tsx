"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewDrugPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", genericName: "", category: "", manufacturer: "",
    dosageForm: "", strength: "", unit: "tablets",
    unitPrice: 0, currentStock: 0, reorderLevel: 10,
    expiryDate: "", description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/pharmacy/drugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/pharmacy");
    } finally { setSaving(false); }
  };

  const update = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Add New Drug" description="Register a new drug in the pharmacy inventory" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Drug Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Drug Name</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div><Label>Generic Name</Label><Input value={form.genericName} onChange={(e) => update("genericName", e.target.value)} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="e.g., Antibiotic, Analgesic" /></div>
            <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => update("manufacturer", e.target.value)} /></div>
            <div><Label>Dosage Form</Label><Input value={form.dosageForm} onChange={(e) => update("dosageForm", e.target.value)} placeholder="e.g., Tablet, Capsule, Syrup" /></div>
            <div><Label>Strength</Label><Input value={form.strength} onChange={(e) => update("strength", e.target.value)} placeholder="e.g., 500mg" /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Stock & Pricing</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Unit Price ($)</Label><Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update("unitPrice", parseFloat(e.target.value) || 0)} required /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} /></div>
            <div><Label>Initial Stock</Label><Input type="number" min="0" value={form.currentStock} onChange={(e) => update("currentStock", parseInt(e.target.value) || 0)} /></div>
            <div><Label>Reorder Level</Label><Input type="number" min="0" value={form.reorderLevel} onChange={(e) => update("reorderLevel", parseInt(e.target.value) || 0)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={(e) => update("expiryDate", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Drug"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
