"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DrugDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [drug, setDrug] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetch(`/api/pharmacy/drugs/${id}`)
      .then((r) => r.json())
      .then((data) => { setDrug(data.data); setForm(data.data || {}); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const res = await fetch(`/api/pharmacy/drugs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setDrug(form); setEditing(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!drug) return <div className="text-center py-8">Drug not found</div>;

  const d = editing ? form : drug;

  return (
    <div className="space-y-6">
      <PageHeader title={d.name as string} description={d.genericName as string}>
        <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stock</CardTitle></CardHeader>
          <CardContent className={`text-xl font-bold ${(d.currentStock as number) <= (d.reorderLevel as number) ? "text-red-600" : ""}`}>{d.currentStock as number} {d.unit as string}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unit Price</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">${(d.unitPrice as number)?.toFixed(2)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reorder Level</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{d.reorderLevel as number}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent><StatusBadge status={d.isActive ? "Active" : "Inactive"} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Drug Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {editing ? (
            <>
              <div><Label>Name</Label><Input value={form.name as string} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Generic Name</Label><Input value={form.genericName as string} onChange={(e) => setForm((p) => ({ ...p, genericName: e.target.value }))} /></div>
              <div><Label>Category</Label><Input value={form.category as string} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
              <div><Label>Manufacturer</Label><Input value={form.manufacturer as string} onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))} /></div>
              <div><Label>Unit Price</Label><Input type="number" value={form.unitPrice as number} onChange={(e) => setForm((p) => ({ ...p, unitPrice: parseFloat(e.target.value) }))} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.currentStock as number} onChange={(e) => setForm((p) => ({ ...p, currentStock: parseInt(e.target.value) }))} /></div>
            </>
          ) : (
            <>
              <div><span className="text-sm text-muted-foreground">Category:</span><p>{d.category as string}</p></div>
              <div><span className="text-sm text-muted-foreground">Manufacturer:</span><p>{(d.manufacturer as string) || "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Dosage Form:</span><p>{(d.dosageForm as string) || "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Strength:</span><p>{(d.strength as string) || "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Expiry Date:</span><p>{d.expiryDate ? new Date(d.expiryDate as string).toLocaleDateString() : "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Description:</span><p>{(d.description as string) || "N/A"}</p></div>
            </>
          )}
        </CardContent>
      </Card>

      {editing && (
        <div className="flex gap-4">
          <Button onClick={handleSave}>Save Changes</Button>
          <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
