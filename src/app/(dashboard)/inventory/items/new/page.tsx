"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "", unit: "pcs", description: "",
    unitCost: 0, currentStock: 0, reorderLevel: 10,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/inventory");
    } finally { setSaving(false); }
  };

  const update = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Add Inventory Item" description="Register a new item in inventory" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Item Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Item Name</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="e.g., Medical Supplies, Equipment" /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} /></div>
            <div><Label>Unit Cost ($)</Label><Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => update("unitCost", parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Initial Stock</Label><Input type="number" min="0" value={form.currentStock} onChange={(e) => update("currentStock", parseInt(e.target.value) || 0)} /></div>
            <div><Label>Reorder Level</Label><Input type="number" min="0" value={form.reorderLevel} onChange={(e) => update("reorderLevel", parseInt(e.target.value) || 0)} /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
          </CardContent>
        </Card>
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Item"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
