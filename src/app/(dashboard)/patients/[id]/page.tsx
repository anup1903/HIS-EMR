"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Calendar, Stethoscope, BedDouble } from "lucide-react";

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((r) => r.json())
      .then((data) => setPatient(data.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!patient) return <div className="text-center py-8">Patient not found</div>;

  const p = patient as Record<string, string | unknown[]>;

  return (
    <div className="space-y-6">
      <PageHeader title={`${p.firstName} ${p.lastName}`} description={`MRN: ${p.mrn}`}>
        <Button variant="outline" asChild><Link href={`/patients/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Gender</CardTitle></CardHeader><CardContent><StatusBadge status={p.gender as string} /></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Phone</CardTitle></CardHeader><CardContent className="font-medium">{p.phone as string}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Date of Birth</CardTitle></CardHeader><CardContent className="font-medium">{new Date(p.dateOfBirth as string).toLocaleDateString()}</CardContent></Card>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="consultations">Consultations</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div><span className="text-sm text-muted-foreground">Address:</span><p>{p.address as string}, {p.city as string}, {p.state as string} {p.zipCode as string}</p></div>
              <div><span className="text-sm text-muted-foreground">Email:</span><p>{(p.email as string) || "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Blood Group:</span><p>{(p.bloodGroup as string)?.replace("_", " ") || "N/A"}</p></div>
              <div><span className="text-sm text-muted-foreground">Allergies:</span><p>{(p.allergies as string) || "None reported"}</p></div>
              <div><span className="text-sm text-muted-foreground">Chronic Conditions:</span><p>{(p.chronicConditions as string) || "None reported"}</p></div>
              <div><span className="text-sm text-muted-foreground">Emergency Contact:</span><p>{(p.emergencyName as string) || "N/A"} {p.emergencyPhone ? `(${p.emergencyPhone})` : ""}</p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card><CardContent className="pt-6">
            {(p.appointments as unknown[])?.length ? (
              <div className="space-y-3">
                {(p.appointments as Record<string, string>[]).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between border-b pb-2">
                    <div><Calendar className="inline h-4 w-4 mr-2" /><span className="text-sm">{new Date(apt.date).toLocaleDateString()} at {apt.startTime}</span></div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No appointments found</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="consultations">
          <Card><CardContent className="pt-6">
            {(p.consultations as unknown[])?.length ? (
              <div className="space-y-3">
                {(p.consultations as Record<string, string>[]).map((con) => (
                  <div key={con.id} className="flex items-center justify-between border-b pb-2">
                    <div><Stethoscope className="inline h-4 w-4 mr-2" /><span className="text-sm">{con.consultationNo} - {con.diagnosis}</span></div>
                    <StatusBadge status={con.status} />
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No consultations found</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="admissions">
          <Card><CardContent className="pt-6">
            {(p.admissions as unknown[])?.length ? (
              <div className="space-y-3">
                {(p.admissions as Record<string, string>[]).map((adm) => (
                  <div key={adm.id} className="flex items-center justify-between border-b pb-2">
                    <div><BedDouble className="inline h-4 w-4 mr-2" /><span className="text-sm">{adm.admissionNo} - {adm.admissionReason}</span></div>
                    <StatusBadge status={adm.status} />
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No admissions found</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
