"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdmissionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [admission, setAdmission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch(`/api/ipd/admissions/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAdmission(data.data);
        setNotes((data.data?.progressNotes as Record<string, unknown>[]) || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    const res = await fetch(`/api/ipd/admissions/${id}/progress-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText, noteType: "PROGRESS" }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes((prev) => [data.data, ...prev]);
      setNoteText("");
    }
  };

  const discharge = async () => {
    const res = await fetch(`/api/ipd/admissions/${id}/discharge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dischargeSummary: "Patient discharged in stable condition." }),
    });
    if (res.ok) router.push("/ipd");
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!admission) return <div className="text-center py-8">Admission not found</div>;

  const a = admission;
  const patient = a.patient as Record<string, string>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Admission ${a.admissionNo}`} description={`${patient?.firstName} ${patient?.lastName}`}>
        <StatusBadge status={a.status as string} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ward / Bed</CardTitle></CardHeader>
          <CardContent>{(a.ward as Record<string, string>)?.name} / Bed {(a.bed as Record<string, string>)?.bedNumber}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Doctor</CardTitle></CardHeader>
          <CardContent>Dr. {(a.doctor as Record<string, Record<string, string>>)?.user?.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admitted</CardTitle></CardHeader>
          <CardContent>{new Date(a.admissionDate as string).toLocaleDateString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reason</CardTitle></CardHeader>
          <CardContent>{a.admissionReason as string}</CardContent></Card>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Progress Notes</TabsTrigger>
          <TabsTrigger value="orders">Doctor Orders</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <Card><CardContent className="pt-6 space-y-4">
            {a.status === "ADMITTED" && (
              <div className="flex gap-2">
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a progress note..." />
                <Button onClick={addNote} className="self-end">Add Note</Button>
              </div>
            )}
            {notes.length === 0 ? <p className="text-muted-foreground">No notes recorded</p> : (
              <div className="space-y-3">
                {notes.map((note, i) => (
                  <div key={i} className="border-b pb-3">
                    <p className="text-sm text-muted-foreground">{new Date(note.createdAt as string).toLocaleString()} - {note.noteType as string}</p>
                    <p>{note.note as string}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardContent className="pt-6">
            {((a.doctorOrders as unknown[]) || []).length === 0 ? <p className="text-muted-foreground">No orders</p> : (
              <div className="space-y-3">
                {(a.doctorOrders as Record<string, unknown>[]).map((order, i) => (
                  <div key={i} className="border-b pb-2 flex justify-between">
                    <div>
                      <p className="font-medium">{order.orderType as string}</p>
                      <p className="text-sm text-muted-foreground">{order.description as string}</p>
                    </div>
                    <StatusBadge status={order.status as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vitals">
          <Card><CardContent className="pt-6">
            <p className="text-muted-foreground">Vitals monitoring view - charts and latest readings</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {a.status === "ADMITTED" && (
        <Card><CardContent className="pt-6 flex gap-3">
          <Button variant="destructive" onClick={discharge}>Discharge Patient</Button>
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </CardContent></Card>
      )}
    </div>
  );
}
