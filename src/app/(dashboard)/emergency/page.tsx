"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Activity, Clock, UserPlus, Eye, Plus } from "lucide-react";

const TRIAGE_COLORS: Record<string, string> = {
  RESUSCITATION: "bg-red-600 text-white",
  EMERGENT: "bg-red-100 text-red-800",
  URGENT: "bg-orange-100 text-orange-800",
  LESS_URGENT: "bg-yellow-100 text-yellow-800",
  NON_URGENT: "bg-green-100 text-green-800",
};

export default function EmergencyPage() {
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/emergency/visits")
      .then((r) => r.json())
      .then((data) => setVisits(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const activeVisits = visits.filter((v) => v.disposition === "UNDER_OBSERVATION");
  const criticalCount = visits.filter((v) => v.triageLevel === "RESUSCITATION" || v.triageLevel === "EMERGENT").length;
  const todayCount = visits.filter((v) => {
    const visitDate = new Date(v.arrivalTime as string).toDateString();
    return visitDate === new Date().toDateString();
  }).length;
  const admittedCount = visits.filter((v) => v.disposition === "ADMITTED").length;

  const filtered = visits.filter((v) => {
    const patientName = v.patientId
      ? `${(v.patient as Record<string, string>)?.firstName || ""} ${(v.patient as Record<string, string>)?.lastName || ""}`
      : (v.walkInName as string) || "";
    return `${patientName} ${v.visitNo} ${v.chiefComplaint}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Emergency Department" description="Emergency room triage and patient management">
        <Button asChild><Link href="/emergency/new"><Plus className="mr-2 h-4 w-4" />New Visit</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Cases" value={activeVisits.length} icon={Activity} />
        <StatsCard title="Critical Patients" value={criticalCount} icon={AlertTriangle} />
        <StatsCard title="Today's Visits" value={todayCount} icon={Clock} />
        <StatsCard title="Admitted" value={admittedCount} icon={UserPlus} />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Cases ({activeVisits.length})</TabsTrigger>
          <TabsTrigger value="all">All Visits</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : activeVisits.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active emergency cases</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visit #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Triage</TableHead>
                      <TableHead>Chief Complaint</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeVisits.map((visit) => (
                      <TableRow key={visit.id as string}>
                        <TableCell className="font-medium">{visit.visitNo as string}</TableCell>
                        <TableCell>
                          {visit.patientId
                            ? `${(visit.patient as Record<string, string>)?.firstName} ${(visit.patient as Record<string, string>)?.lastName}`
                            : (visit.walkInName as string) || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRIAGE_COLORS[(visit.triageLevel as string)] || "bg-gray-100 text-gray-800"}`}>
                            {(visit.triageLevel as string)?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{visit.chiefComplaint as string}</TableCell>
                        <TableCell>{new Date(visit.arrivalTime as string).toLocaleTimeString()}</TableCell>
                        <TableCell>{(visit.arrivalMode as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell><StatusBadge status={visit.disposition as string} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/emergency/${visit.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Input placeholder="Search visits..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
              {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No emergency visits found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visit #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Triage</TableHead>
                      <TableHead>Chief Complaint</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Disposition</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((visit) => (
                      <TableRow key={visit.id as string}>
                        <TableCell className="font-medium">{visit.visitNo as string}</TableCell>
                        <TableCell>
                          {visit.patientId
                            ? `${(visit.patient as Record<string, string>)?.firstName} ${(visit.patient as Record<string, string>)?.lastName}`
                            : (visit.walkInName as string) || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRIAGE_COLORS[(visit.triageLevel as string)] || "bg-gray-100 text-gray-800"}`}>
                            {(visit.triageLevel as string)?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{visit.chiefComplaint as string}</TableCell>
                        <TableCell>{new Date(visit.arrivalTime as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={visit.disposition as string} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/emergency/${visit.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
