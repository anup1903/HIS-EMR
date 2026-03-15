"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewTelemedicineSessionPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; user: { name: string }; specialization: string }[]>([]);
  const [form, setForm] = useState({
    patientId: "", doctorId: "", scheduledDate: new Date().toISOString().split("T")[0],
    scheduledTime: "10:00", duration: "30", meetingPlatform: "BUILT_IN",
    meetingLink: "", chiefComplaint: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?limit=200").then((r) => r.json()),
      fetch("/api/doctors").then((r) => r.json()),
    ]).then(([pData, dData]) => {
      setPatients(pData.data || []);
      setDoctors(dData.data || []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/telemedicine/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, duration: Number(form.duration) }),
    });
    if (res.ok) router.push("/telemedicine");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule Telemedicine Session" description="Create a new virtual consultation" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Session Details</CardTitle></CardHeader>
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
                <Label>Doctor *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.doctorId} onChange={(e) => setForm({ ...form, doctorId: e.target.value })} required>
                  <option value="">Select Doctor</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.user?.name} ({d.specialization})</option>)}
                </select>
              </div>
              <div><Label>Date *</Label><Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} required /></div>
              <div><Label>Time *</Label><Input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} required /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></div>
              <div>
                <Label>Platform</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.meetingPlatform} onChange={(e) => setForm({ ...form, meetingPlatform: e.target.value })}>
                  <option value="BUILT_IN">Built-in</option><option value="ZOOM">Zoom</option><option value="GOOGLE_MEET">Google Meet</option><option value="TEAMS">Microsoft Teams</option>
                </select>
              </div>
              <div className="md:col-span-2"><Label>Meeting Link</Label><Input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://..." /></div>
              <div className="md:col-span-2"><Label>Chief Complaint</Label><Textarea value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Scheduling..." : "Schedule Session"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/telemedicine")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
