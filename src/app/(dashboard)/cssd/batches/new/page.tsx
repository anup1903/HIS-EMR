"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewSterilizationBatchPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [form, setForm] = useState({
    instrumentSetId: "", method: "AUTOCLAVE", cycleNumber: "", machineId: "",
    temperature: "", pressure: "", duration: "", notes: "",
  });

  useEffect(() => {
    fetch("/api/cssd/instruments").then((r) => r.json()).then((d) => setInstruments(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      pressure: form.pressure ? Number(form.pressure) : undefined,
      duration: form.duration ? Number(form.duration) : undefined,
    };
    const res = await fetch("/api/cssd/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) router.push("/cssd");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Sterilization Batch" description="Start a new sterilization cycle" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Batch Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Instrument Set *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.instrumentSetId} onChange={(e) => setForm({ ...form, instrumentSetId: e.target.value })} required>
                  <option value="">Select Instrument Set</option>
                  {instruments.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                </select>
              </div>
              <div>
                <Label>Method *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="AUTOCLAVE">Autoclave (Steam)</option><option value="ETO">ETO (Ethylene Oxide)</option>
                  <option value="PLASMA">Plasma</option><option value="CHEMICAL">Chemical</option>
                </select>
              </div>
              <div><Label>Cycle Number</Label><Input value={form.cycleNumber} onChange={(e) => setForm({ ...form, cycleNumber: e.target.value })} /></div>
              <div><Label>Machine ID</Label><Input value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })} /></div>
              <div><Label>Temperature (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
              <div><Label>Pressure (bar)</Label><Input type="number" step="0.01" value={form.pressure} onChange={(e) => setForm({ ...form, pressure: e.target.value })} /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Starting..." : "Start Sterilization"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/cssd")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
