"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewInstrumentSetPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", department: "", items: "", totalItems: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/cssd/instruments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalItems: Number(form.totalItems) }),
    });
    if (res.ok) router.push("/cssd");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Instrument Set" description="Register a new instrument set for sterilization" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Instrument Set Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., General Surgery Set" /></div>
              <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="e.g., GS-001" /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g., Surgery" /></div>
              <div><Label>Total Items *</Label><Input type="number" value={form.totalItems} onChange={(e) => setForm({ ...form, totalItems: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Items List</Label><Textarea value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} rows={4} placeholder="List instruments (one per line or comma-separated)" /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Instrument Set"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/cssd")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
