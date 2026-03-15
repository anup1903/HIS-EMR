"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdmitPatientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>[]>([]);
  const [wards, setWards] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({
    patientId: "", doctorId: "", departmentId: "", wardId: "", bedId: "",
    admissionDate: new Date().toISOString().split("T")[0],
    admissionReason: "", admissionType: "EMERGENCY",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?limit=100").then((r) => r.json()),
      fetch("/api/hr/departments").then((r) => r.json()),
      fetch("/api/ipd/beds").then((r) => r.json()),
    ]).then(([pData, dData, bData]) => {
      setPatients(pData.data || []);
      setDepartments(dData.data || []);
      setWards(bData.data || []);
    });
  }, []);

  const availableBeds = form.wardId
    ? ((wards.find((w) => (w.id as string) === form.wardId)?.beds as Record<string, string>[]) || []).filter((b) => b.status === "AVAILABLE")
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/ipd/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/ipd");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="New Admission" description="Admit a patient to the hospital" />
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
          <CardHeader><CardTitle>Ward & Bed Assignment</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Ward</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.wardId} onChange={(e) => { update("wardId", e.target.value); update("bedId", ""); }} required>
                <option value="">Select Ward</option>
                {wards.map((w: Record<string, unknown>) => <option key={w.id as string} value={w.id as string}>{w.name as string}</option>)}
              </select>
            </div>
            <div>
              <Label>Bed</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.bedId} onChange={(e) => update("bedId", e.target.value)} required>
                <option value="">Select Bed</option>
                {availableBeds.map((b) => <option key={b.id} value={b.id}>Bed {b.bedNumber}</option>)}
              </select>
            </div>
            <div>
              <Label>Admission Date</Label>
              <Input type="date" value={form.admissionDate} onChange={(e) => update("admissionDate", e.target.value)} required />
            </div>
            <div>
              <Label>Admission Type</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.admissionType} onChange={(e) => update("admissionType", e.target.value)}>
                <option value="EMERGENCY">Emergency</option>
                <option value="PLANNED">Planned</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Reason for Admission</Label>
              <Textarea value={form.admissionReason} onChange={(e) => update("admissionReason", e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Admitting..." : "Admit Patient"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
