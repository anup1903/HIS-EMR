"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileHeart, Search, Plus, Eye, X } from "lucide-react";

interface MedicalRecord {
  id: string; recordNo: string; visitType: string; visitDate: string; chiefComplaint: string;
  diagnosis: string; specialty: string; status: string; recordedBy: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
}

export default function EMRPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [form, setForm] = useState({ patientId: "", visitType: "OPD", chiefComplaint: "", diagnosis: "",
    historyOfPresentIllness: "", pastMedicalHistory: "", familyHistory: "", physicalExamination: "",
    treatmentPlan: "", medications: "", followUpInstructions: "", specialty: "", icdCodes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = () => {
    fetch("/api/emr/records?limit=50").then(r => r.json()).then(d => setRecords(d.data || [])).finally(() => setLoading(false));
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await fetch("/api/emr/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowCreate(false); fetchRecords(); setForm({ patientId: "", visitType: "OPD", chiefComplaint: "", diagnosis: "", historyOfPresentIllness: "", pastMedicalHistory: "", familyHistory: "", physicalExamination: "", treatmentPlan: "", medications: "", followUpInstructions: "", specialty: "", icdCodes: "" }); }
    setSaving(false);
  };

  useEffect(() => { if (showCreate) fetch("/api/patients?limit=100").then(r => r.json()).then(d => setPatients(d.data || [])); }, [showCreate]);

  const filtered = records.filter(r => `${r.patient?.firstName} ${r.patient?.lastName} ${r.recordNo} ${r.diagnosis}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Electronic Medical Records" description="Comprehensive patient medical history across all visits">
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />New Record</Button>
      </PageHeader>

      {selectedRecord ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Record {selectedRecord.recordNo}</CardTitle>
              <Button variant="ghost" onClick={() => setSelectedRecord(null)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label className="text-muted-foreground">Patient</Label><p className="font-medium">{selectedRecord.patient?.firstName} {selectedRecord.patient?.lastName}</p></div>
              <div><Label className="text-muted-foreground">Visit Type</Label><p><StatusBadge status={selectedRecord.visitType} /></p></div>
              <div><Label className="text-muted-foreground">Date</Label><p>{new Date(selectedRecord.visitDate).toLocaleDateString()}</p></div>
              <div><Label className="text-muted-foreground">Specialty</Label><p>{selectedRecord.specialty || "General"}</p></div>
              <div className="md:col-span-2"><Label className="text-muted-foreground">Chief Complaint</Label><p>{selectedRecord.chiefComplaint}</p></div>
              <div className="md:col-span-2"><Label className="text-muted-foreground">Diagnosis</Label><p className="font-medium">{selectedRecord.diagnosis}</p></div>
            </div>
          </CardContent>
        </Card>
      ) : showCreate ? (
        <Card>
          <CardHeader><CardTitle>Create Medical Record</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} required>
                  <option value="">Select Patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <Label>Visit Type *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.visitType} onChange={e => setForm({...form, visitType: e.target.value})}>
                  <option value="OPD">OPD</option><option value="IPD">IPD</option><option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <div><Label>Specialty</Label><Input value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} placeholder="e.g., Cardiology" /></div>
              <div><Label>ICD Codes</Label><Input value={form.icdCodes} onChange={e => setForm({...form, icdCodes: e.target.value})} placeholder="e.g., J06.9" /></div>
              <div className="md:col-span-2"><Label>Chief Complaint *</Label><Textarea value={form.chiefComplaint} onChange={e => setForm({...form, chiefComplaint: e.target.value})} /></div>
              <div className="md:col-span-2"><Label>History of Present Illness</Label><Textarea value={form.historyOfPresentIllness} onChange={e => setForm({...form, historyOfPresentIllness: e.target.value})} /></div>
              <div><Label>Past Medical History</Label><Textarea value={form.pastMedicalHistory} onChange={e => setForm({...form, pastMedicalHistory: e.target.value})} /></div>
              <div><Label>Family History</Label><Textarea value={form.familyHistory} onChange={e => setForm({...form, familyHistory: e.target.value})} /></div>
              <div className="md:col-span-2"><Label>Physical Examination</Label><Textarea value={form.physicalExamination} onChange={e => setForm({...form, physicalExamination: e.target.value})} /></div>
              <div className="md:col-span-2"><Label>Diagnosis *</Label><Textarea value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} /></div>
              <div><Label>Treatment Plan</Label><Textarea value={form.treatmentPlan} onChange={e => setForm({...form, treatmentPlan: e.target.value})} /></div>
              <div><Label>Medications</Label><Textarea value={form.medications} onChange={e => setForm({...form, medications: e.target.value})} /></div>
              <div className="md:col-span-2"><Label>Follow-up Instructions</Label><Textarea value={form.followUpInstructions} onChange={e => setForm({...form, followUpInstructions: e.target.value})} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Save Record"}</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4"><Input placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" /></div>
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No medical records found</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Record #</TableHead><TableHead>Patient</TableHead><TableHead>Visit Type</TableHead>
                    <TableHead>Date</TableHead><TableHead>Chief Complaint</TableHead><TableHead>Diagnosis</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.recordNo}</TableCell>
                        <TableCell>{r.patient?.firstName} {r.patient?.lastName}</TableCell>
                        <TableCell><StatusBadge status={r.visitType} /></TableCell>
                        <TableCell>{new Date(r.visitDate).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.chiefComplaint}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.diagnosis}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => setSelectedRecord(r)}><Eye className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
