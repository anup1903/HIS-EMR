"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TRIAGE_COLORS: Record<string, string> = {
  RESUSCITATION: "bg-red-600 text-white",
  EMERGENT: "bg-red-100 text-red-800",
  URGENT: "bg-orange-100 text-orange-800",
  LESS_URGENT: "bg-yellow-100 text-yellow-800",
  NON_URGENT: "bg-green-100 text-green-800",
};

export default function EmergencyVisitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [visit, setVisit] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [disposition, setDisposition] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/emergency/visits?id=${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        const v = data.data;
        if (v) {
          setVisit(v);
          setTreatmentGiven((v.treatmentGiven as string) || "");
          setDiagnosis((v.diagnosis as string) || "");
          setDisposition((v.disposition as string) || "");
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleUpdate = async () => {
    setSaving(true);
    await fetch(`/api/emergency/visits`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: params.id, treatmentGiven, diagnosis, disposition }),
    });
    setSaving(false);
    router.push("/emergency");
  };

  if (loading) return <div className="p-6"><p className="text-muted-foreground">Loading...</p></div>;
  if (!visit) return <div className="p-6"><p className="text-muted-foreground">Visit not found</p></div>;

  const patientName = visit.patientId
    ? `${(visit.patient as Record<string, string>)?.firstName} ${(visit.patient as Record<string, string>)?.lastName}`
    : (visit.walkInName as string) || "Unknown";

  return (
    <div className="space-y-6">
      <PageHeader title={`Emergency Visit ${visit.visitNo}`} description={`Patient: ${patientName}`}>
        <Button variant="outline" onClick={() => router.push("/emergency")}>Back to ER</Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Patient Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-muted-foreground">Name</Label><p className="font-medium">{patientName}</p></div>
            {visit.walkInAge ? <div><Label className="text-muted-foreground">Age</Label><p>{visit.walkInAge as number} years</p></div> : null}
            {visit.walkInGender ? <div><Label className="text-muted-foreground">Gender</Label><p>{visit.walkInGender as string}</p></div> : null}
            <div><Label className="text-muted-foreground">Arrival Mode</Label><p>{(visit.arrivalMode as string)?.replace(/_/g, " ")}</p></div>
            <div><Label className="text-muted-foreground">Arrival Time</Label><p>{new Date(visit.arrivalTime as string).toLocaleString()}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Triage Assessment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Triage Level</Label>
              <p><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRIAGE_COLORS[(visit.triageLevel as string)] || "bg-gray-100 text-gray-800"}`}>{(visit.triageLevel as string)?.replace(/_/g, " ")}</span></p>
            </div>
            <div><Label className="text-muted-foreground">Chief Complaint</Label><p>{visit.chiefComplaint as string}</p></div>
            {visit.injuryType ? <div><Label className="text-muted-foreground">Injury Type</Label><p>{visit.injuryType as string}</p></div> : null}
            {visit.consciousnessLevel ? <div><Label className="text-muted-foreground">Consciousness (AVPU)</Label><p>{visit.consciousnessLevel as string}</p></div> : null}
            <div><Label className="text-muted-foreground">Stabilized</Label><p>{visit.isStabilized ? "Yes" : "No"}</p></div>
            <div><Label className="text-muted-foreground">Disposition</Label><p><StatusBadge status={visit.disposition as string} /></p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Treatment & Disposition</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Diagnosis</Label><Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Enter diagnosis..." /></div>
          <div><Label>Treatment Given</Label><Textarea value={treatmentGiven} onChange={(e) => setTreatmentGiven(e.target.value)} placeholder="Describe treatment provided..." /></div>
          <div>
            <Label>Disposition</Label>
            <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
              <option value="UNDER_OBSERVATION">Under Observation</option><option value="ADMITTED">Admitted</option><option value="DISCHARGED">Discharged</option>
              <option value="TRANSFERRED">Transferred</option><option value="LAMA">LAMA</option><option value="DECEASED">Deceased</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving..." : "Update Visit"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
