"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewConsultationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>[]>([]);
  const [form, setForm] = useState({
    patientId: "", doctorId: "", departmentId: "",
    chiefComplaint: "", presentIllness: "", diagnosis: "",
    treatment: "", notes: "",
  });
  const [vitals, setVitals] = useState({
    bloodPressureSystolic: "", bloodPressureDiastolic: "",
    heartRate: "", temperature: "", respiratoryRate: "",
    oxygenSaturation: "", weight: "", height: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?limit=100").then((r) => r.json()),
      fetch("/api/hr/departments").then((r) => r.json()),
    ]).then(([pData, dData]) => {
      setPatients(pData.data || []);
      setDepartments(dData.data || []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/opd/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        const consultationId = data.data?.id;
        // Record vitals if any provided
        const hasVitals = Object.values(vitals).some((v) => v !== "");
        if (hasVitals && consultationId) {
          const vitalsData: Record<string, unknown> = { consultationId, patientId: form.patientId };
          Object.entries(vitals).forEach(([k, v]) => { if (v) vitalsData[k] = parseFloat(v); });
          await fetch("/api/opd/vitals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vitalsData),
          });
        }
        router.push(`/opd/consultations/${consultationId}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateVitals = (field: string, value: string) => setVitals((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="New Consultation" description="Start a new OPD consultation" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Patient & Doctor</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Patient</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => update("patientId", e.target.value)} required>
                <option value="">Select Patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
              </select>
            </div>
            <div>
              <Label>Department</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} required>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vitals</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div><Label>BP Systolic (mmHg)</Label><Input type="number" value={vitals.bloodPressureSystolic} onChange={(e) => updateVitals("bloodPressureSystolic", e.target.value)} /></div>
            <div><Label>BP Diastolic (mmHg)</Label><Input type="number" value={vitals.bloodPressureDiastolic} onChange={(e) => updateVitals("bloodPressureDiastolic", e.target.value)} /></div>
            <div><Label>Heart Rate (bpm)</Label><Input type="number" value={vitals.heartRate} onChange={(e) => updateVitals("heartRate", e.target.value)} /></div>
            <div><Label>Temperature (°F)</Label><Input type="number" step="0.1" value={vitals.temperature} onChange={(e) => updateVitals("temperature", e.target.value)} /></div>
            <div><Label>Respiratory Rate</Label><Input type="number" value={vitals.respiratoryRate} onChange={(e) => updateVitals("respiratoryRate", e.target.value)} /></div>
            <div><Label>O2 Saturation (%)</Label><Input type="number" value={vitals.oxygenSaturation} onChange={(e) => updateVitals("oxygenSaturation", e.target.value)} /></div>
            <div><Label>Weight (kg)</Label><Input type="number" step="0.1" value={vitals.weight} onChange={(e) => updateVitals("weight", e.target.value)} /></div>
            <div><Label>Height (cm)</Label><Input type="number" step="0.1" value={vitals.height} onChange={(e) => updateVitals("height", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Clinical Notes</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div><Label>Chief Complaint</Label><Textarea value={form.chiefComplaint} onChange={(e) => update("chiefComplaint", e.target.value)} required /></div>
            <div><Label>Present Illness History</Label><Textarea value={form.presentIllness} onChange={(e) => update("presentIllness", e.target.value)} /></div>
            <div><Label>Diagnosis</Label><Textarea value={form.diagnosis} onChange={(e) => update("diagnosis", e.target.value)} /></div>
            <div><Label>Treatment Plan</Label><Textarea value={form.treatment} onChange={(e) => update("treatment", e.target.value)} /></div>
            <div><Label>Additional Notes</Label><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Start Consultation"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
