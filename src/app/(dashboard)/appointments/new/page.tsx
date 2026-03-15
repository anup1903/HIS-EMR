"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Doctor {
  id: string;
  specialization: string;
  departmentId: string;
  user: { name: string };
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>[]>([]);
  const [form, setForm] = useState({
    patientId: "", doctorId: "", departmentId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00", endTime: "09:30",
    type: "CONSULTATION", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?limit=100").then((r) => r.json()),
      fetch("/api/hr/departments").then((r) => r.json()),
      fetch("/api/doctors").then((r) => r.json()),
    ]).then(([pData, deptData, docData]) => {
      setPatients(pData.data || []);
      setDepartments(deptData.data || []);
      setDoctors(docData.data || []);
    });
  }, []);

  const filteredDoctors = form.departmentId
    ? doctors.filter((d) => d.departmentId === form.departmentId)
    : doctors;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.patientId) { setErrorMsg("Please select a patient"); return; }
    if (!form.doctorId) { setErrorMsg("Please select a doctor"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/appointments");
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to book appointment");
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "departmentId") next.doctorId = "";
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Book Appointment" description="Schedule a new patient appointment" />
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{errorMsg}</div>
        ) : null}
        <Card>
          <CardHeader><CardTitle>Appointment Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Patient *</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => update("patientId", e.target.value)} required>
                <option value="">Select Patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
              </select>
            </div>
            <div>
              <Label>Department</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Doctor *</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.doctorId} onChange={(e) => update("doctorId", e.target.value)} required>
                <option value="">Select Doctor</option>
                {filteredDoctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.user?.name} ({d.specialization})</option>)}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.type} onChange={(e) => update("type", e.target.value)}>
                <option value="CONSULTATION">Consultation</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="PROCEDURE">Procedure</option>
                <option value="LAB_VISIT">Lab Visit</option>
                <option value="IMAGING">Imaging</option>
              </select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Time *</Label>
                <Input type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} required />
              </div>
              <div>
                <Label>End Time *</Label>
                <Input type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} required />
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Additional notes..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Booking..." : "Book Appointment"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
