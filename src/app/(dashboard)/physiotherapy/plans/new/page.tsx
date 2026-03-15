"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTherapyPlanPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [form, setForm] = useState({
    patientId: "", diagnosis: "", condition: "", goals: "", treatmentProtocol: "",
    frequency: "", totalSessions: "", startDate: new Date().toISOString().split("T")[0], notes: "",
  });

  useEffect(() => {
    fetch("/api/patients?limit=200").then((r) => r.json()).then((d) => setPatients(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/physiotherapy/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, totalSessions: form.totalSessions ? Number(form.totalSessions) : undefined }),
    });
    if (res.ok) router.push("/physiotherapy");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Treatment Plan" description="Create a physiotherapy treatment plan" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Plan Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                </select>
              </div>
              <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Diagnosis *</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} required placeholder="e.g., Frozen shoulder, Post ACL reconstruction..." /></div>
              <div><Label>Condition</Label><Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="e.g., Chronic, Acute, Post-surgical" /></div>
              <div><Label>Frequency</Label><Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g., 3 times/week" /></div>
              <div><Label>Total Sessions</Label><Input type="number" value={form.totalSessions} onChange={(e) => setForm({ ...form, totalSessions: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Goals</Label><Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} placeholder="Short-term and long-term rehabilitation goals..." /></div>
              <div className="md:col-span-2"><Label>Treatment Protocol</Label><Textarea value={form.treatmentProtocol} onChange={(e) => setForm({ ...form, treatmentProtocol: e.target.value })} placeholder="Exercises, modalities, manual therapy techniques..." /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Plan"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/physiotherapy")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
