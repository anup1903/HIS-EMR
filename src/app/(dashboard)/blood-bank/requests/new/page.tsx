"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewBloodRequestPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [form, setForm] = useState({
    patientId: "", bloodGroup: "O_POSITIVE", component: "WHOLE_BLOOD",
    unitsRequired: "1", reason: "", urgency: "ROUTINE", requiredDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    fetch("/api/patients?limit=200").then((r) => r.json()).then((d) => setPatients(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/blood-bank/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, unitsRequired: Number(form.unitsRequired) }),
    });
    if (res.ok) router.push("/blood-bank");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Blood Request" description="Request blood units for a patient" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Request Details</CardTitle></CardHeader>
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
                <Label>Blood Group *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                  {["A_POSITIVE","A_NEGATIVE","B_POSITIVE","B_NEGATIVE","AB_POSITIVE","AB_NEGATIVE","O_POSITIVE","O_NEGATIVE"].map((bg) => (
                    <option key={bg} value={bg}>{bg.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-")}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Component *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })}>
                  <option value="WHOLE_BLOOD">Whole Blood</option><option value="PACKED_RBC">Packed RBC</option><option value="PLATELET">Platelet</option>
                  <option value="PLASMA">Plasma</option><option value="CRYOPRECIPITATE">Cryoprecipitate</option>
                </select>
              </div>
              <div><Label>Units Required *</Label><Input type="number" min="1" value={form.unitsRequired} onChange={(e) => setForm({ ...form, unitsRequired: e.target.value })} required /></div>
              <div>
                <Label>Urgency *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  <option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT (Immediate)</option>
                </select>
              </div>
              <div><Label>Required Date *</Label><Input type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Reason *</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required placeholder="e.g., Pre-surgical, Anemia treatment..." /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Request"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/blood-bank")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
