"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle } from "lucide-react";

const CHECKLIST_ITEMS = {
  PRE_OP: ["Patient identity confirmed", "Surgical site marked", "Consent form signed", "Anesthesia assessment complete", "Pre-op labs reviewed", "Blood availability confirmed", "NPO status verified"],
  SIGN_IN: ["Patient identity re-confirmed", "Site and procedure confirmed", "Anesthesia safety check", "Pulse oximeter functioning", "Known allergy reviewed", "Airway risk assessed"],
  TIME_OUT: ["All team members introduced", "Patient name and procedure confirmed", "Surgical site confirmed", "Antibiotic prophylaxis given", "Anticipated critical events reviewed", "Essential imaging displayed"],
  SIGN_OUT: ["Procedure name confirmed", "Instrument/sponge count correct", "Specimen labeled", "Equipment issues noted", "Key recovery concerns reviewed"],
};

export default function SurgeryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [surgery, setSurgery] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [operativeNotes, setOperativeNotes] = useState("");
  const [postOpInstructions, setPostOpInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [checklists, setChecklists] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/surgery/schedule?id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.data;
        if (s) {
          setSurgery(s);
          setOperativeNotes((s.operativeNotes as string) || "");
          setPostOpInstructions((s.postOpInstructions as string) || "");
          const existingChecks: Record<string, boolean> = {};
          ((s.checklists as Record<string, unknown>[]) || []).forEach((c) => {
            existingChecks[`${c.phase}-${c.item}`] = c.isCompleted as boolean;
          });
          setChecklists(existingChecks);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleUpdate = async () => {
    setSaving(true);
    await fetch("/api/surgery/schedule", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, operativeNotes, postOpInstructions }),
    });
    setSaving(false);
    router.push("/surgery");
  };

  const toggleChecklist = (phase: string, item: string) => {
    const key = `${phase}-${item}`;
    setChecklists({ ...checklists, [key]: !checklists[key] });
  };

  if (loading) return <div className="p-6"><p className="text-muted-foreground">Loading...</p></div>;
  if (!surgery) return <div className="p-6"><p className="text-muted-foreground">Surgery not found</p></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Surgery ${surgery.surgeryNo}`} description={(surgery.procedureName as string) || ""}>
        <Button variant="outline" onClick={() => router.push("/surgery")}>Back to Schedule</Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Surgery Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-muted-foreground">Patient</Label><p className="font-medium">{(surgery.patient as Record<string, string>)?.firstName} {(surgery.patient as Record<string, string>)?.lastName}</p></div>
            <div><Label className="text-muted-foreground">Procedure</Label><p>{surgery.procedureName as string}</p></div>
            <div><Label className="text-muted-foreground">Surgery Type</Label><p>{(surgery.surgeryType as string)?.replace(/_/g, " ")}</p></div>
            <div><Label className="text-muted-foreground">Diagnosis</Label><p>{surgery.diagnosis as string}</p></div>
            {surgery.laterality && <div><Label className="text-muted-foreground">Laterality</Label><p>{surgery.laterality as string}</p></div>}
            <div><Label className="text-muted-foreground">Anesthesia</Label><p>{(surgery.anesthesiaType as string)?.replace(/_/g, " ") || "TBD"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Schedule & Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-muted-foreground">Date</Label><p>{new Date(surgery.scheduledDate as string).toLocaleDateString()}</p></div>
            <div><Label className="text-muted-foreground">Time</Label><p>{surgery.scheduledStartTime as string} - {surgery.scheduledEndTime as string}</p></div>
            <div><Label className="text-muted-foreground">OT</Label><p>{(surgery.theatre as Record<string, string>)?.name || "-"}</p></div>
            <div><Label className="text-muted-foreground">Status</Label><p><StatusBadge status={surgery.status as string} /></p></div>
            <div><Label className="text-muted-foreground">Priority</Label><p>{(surgery.priority as string)?.replace(/_/g, " ")}</p></div>
            <div><Label className="text-muted-foreground">Consent</Label><p>{surgery.consentObtained ? "Yes" : "Not yet"}</p></div>
            {surgery.estimatedDuration && <div><Label className="text-muted-foreground">Est. Duration</Label><p>{surgery.estimatedDuration as number} minutes</p></div>}
          </CardContent>
        </Card>
      </div>

      {/* Surgical Safety Checklist */}
      <Card>
        <CardHeader><CardTitle>WHO Surgical Safety Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {(Object.entries(CHECKLIST_ITEMS) as [string, string[]][]).map(([phase, items]) => (
              <div key={phase}>
                <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide">
                  {phase.replace(/_/g, " ")}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => {
                    const key = `${phase}-${item}`;
                    return (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={checklists[key] || false} onChange={() => toggleChecklist(phase, item)} className="rounded" />
                        <span className={`text-sm ${checklists[key] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                        {checklists[key] && <CheckCircle className="h-3 w-3 text-green-600" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operative Notes */}
      <Card>
        <CardHeader><CardTitle>Operative Notes & Post-Op Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Operative Notes</Label><Textarea value={operativeNotes} onChange={(e) => setOperativeNotes(e.target.value)} rows={5} placeholder="Document surgical findings, technique, complications..." /></div>
          <div><Label>Post-Op Instructions</Label><Textarea value={postOpInstructions} onChange={(e) => setPostOpInstructions(e.target.value)} rows={4} placeholder="Recovery instructions, medications, follow-up..." /></div>
          <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving..." : "Save Notes"}</Button>
        </CardContent>
      </Card>

      {/* Team Members */}
      {(surgery.teamMembers as Record<string, unknown>[])?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Surgical Team</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((surgery.teamMembers as Record<string, unknown>[]) || []).map((member, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{(member.role as string)?.replace(/_/g, " ")}</TableCell>
                    <TableCell>{member.userId as string}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
