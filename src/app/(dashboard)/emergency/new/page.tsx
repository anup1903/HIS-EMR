"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewEmergencyVisitPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [isRegistered, setIsRegistered] = useState(true);
  const [form, setForm] = useState({
    patientId: "", walkInName: "", walkInAge: "", walkInGender: "", walkInPhone: "",
    arrivalMode: "WALK_IN", triageLevel: "URGENT", chiefComplaint: "",
    injuryType: "", consciousnessLevel: "ALERT", primaryAssessment: "", notes: "",
  });

  useEffect(() => {
    fetch("/api/patients?limit=200").then((r) => r.json()).then((d) => setPatients(d.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { ...form, walkInAge: form.walkInAge ? Number(form.walkInAge) : undefined };
    if (isRegistered) { body.walkInName = ""; body.walkInAge = undefined; body.walkInGender = ""; body.walkInPhone = ""; }
    else { body.patientId = ""; }
    const res = await fetch("/api/emergency/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) router.push("/emergency");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Emergency Visit" description="Register a new emergency department visit" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Patient Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button type="button" variant={isRegistered ? "default" : "outline"} onClick={() => setIsRegistered(true)}>Registered Patient</Button>
              <Button type="button" variant={!isRegistered ? "default" : "outline"} onClick={() => setIsRegistered(false)}>Walk-in / Unregistered</Button>
            </div>

            {isRegistered ? (
              <div>
                <Label>Patient *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                </select>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Name *</Label><Input value={form.walkInName} onChange={(e) => setForm({ ...form, walkInName: e.target.value })} required={!isRegistered} /></div>
                <div><Label>Age</Label><Input type="number" value={form.walkInAge} onChange={(e) => setForm({ ...form, walkInAge: e.target.value })} /></div>
                <div>
                  <Label>Gender</Label>
                  <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.walkInGender} onChange={(e) => setForm({ ...form, walkInGender: e.target.value })}>
                    <option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                  </select>
                </div>
                <div><Label>Phone</Label><Input value={form.walkInPhone} onChange={(e) => setForm({ ...form, walkInPhone: e.target.value })} /></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle>Triage & Assessment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Arrival Mode *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.arrivalMode} onChange={(e) => setForm({ ...form, arrivalMode: e.target.value })}>
                  <option value="WALK_IN">Walk-in</option><option value="AMBULANCE">Ambulance</option><option value="POLICE">Police</option><option value="REFERRED">Referred</option>
                </select>
              </div>
              <div>
                <Label>Triage Level *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.triageLevel} onChange={(e) => setForm({ ...form, triageLevel: e.target.value })}>
                  <option value="RESUSCITATION">Resuscitation (Red)</option><option value="EMERGENT">Emergent (Orange)</option><option value="URGENT">Urgent (Yellow)</option>
                  <option value="LESS_URGENT">Less Urgent (Green)</option><option value="NON_URGENT">Non-Urgent (Blue)</option>
                </select>
              </div>
              <div>
                <Label>Injury Type</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.injuryType} onChange={(e) => setForm({ ...form, injuryType: e.target.value })}>
                  <option value="">Select</option><option value="TRAUMA">Trauma</option><option value="MEDICAL">Medical</option><option value="SURGICAL">Surgical</option>
                  <option value="OBSTETRIC">Obstetric</option><option value="PEDIATRIC">Pediatric</option>
                </select>
              </div>
              <div>
                <Label>Consciousness (AVPU)</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.consciousnessLevel} onChange={(e) => setForm({ ...form, consciousnessLevel: e.target.value })}>
                  <option value="ALERT">Alert</option><option value="VERBAL">Verbal</option><option value="PAIN">Pain</option><option value="UNRESPONSIVE">Unresponsive</option>
                </select>
              </div>
              <div className="md:col-span-2"><Label>Chief Complaint *</Label><Textarea value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Primary Assessment</Label><Textarea value={form.primaryAssessment} onChange={(e) => setForm({ ...form, primaryAssessment: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Register Visit"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/emergency")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
