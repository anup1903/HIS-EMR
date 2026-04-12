"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Siren, Activity, Clock, UserPlus, Eye, Plus, Search } from "lucide-react";

const TRIAGE_BADGE: Record<string, string> = {
  RESUSCITATION: "bg-destructive/10 text-destructive",
  EMERGENT: "bg-destructive/10 text-destructive",
  URGENT: "bg-warning/10 text-warning",
  LESS_URGENT: "bg-info/10 text-info",
  NON_URGENT: "bg-success/10 text-success",
};

const DISPOSITION_BADGE: Record<string, string> = {
  UNDER_OBSERVATION: "bg-info/10 text-info",
  ADMITTED: "bg-warning/10 text-warning",
  DISCHARGED: "bg-success/10 text-success",
  TRANSFERRED: "bg-info/10 text-info",
  LEFT_AMA: "bg-destructive/10 text-destructive",
  DECEASED: "bg-destructive/10 text-destructive",
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
  const triagePending = visits.filter((v) => !v.triageLevel).length;
  const stabilizedCount = visits.filter((v) => v.disposition === "DISCHARGED").length;
  const admittedCount = visits.filter((v) => v.disposition === "ADMITTED").length;

  const filtered = visits.filter((v) => {
    const patientName = v.patientId
      ? `${(v.patient as Record<string, string>)?.firstName || ""} ${(v.patient as Record<string, string>)?.lastName || ""}`
      : (v.walkInName as string) || "";
    return `${patientName} ${v.visitNo} ${v.chiefComplaint}`.toLowerCase().includes(search.toLowerCase());
  });

  function renderVisitRow(visit: Record<string, unknown>) {
    const triageLevel = visit.triageLevel as string;
    const disposition = visit.disposition as string;
    return (
      <TableRow key={visit.id as string} className="hover:bg-secondary/30 transition-colors">
        <TableCell className="font-medium">{visit.visitNo as string}</TableCell>
        <TableCell>
          <span className="font-medium">
            {visit.patientId
              ? `${(visit.patient as Record<string, string>)?.firstName} ${(visit.patient as Record<string, string>)?.lastName}`
              : (visit.walkInName as string) || "Unknown"}
          </span>
        </TableCell>
        <TableCell>
          {triageLevel ? (
            <Badge className={cn("text-xs font-medium", TRIAGE_BADGE[triageLevel] || "bg-secondary text-secondary-foreground")}>
              {triageLevel.replace(/_/g, " ")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>
          )}
        </TableCell>
        <TableCell className="max-w-[200px] truncate text-muted-foreground">{visit.chiefComplaint as string}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {(visit.arrivalMode as string)?.replace(/_/g, " ") || "-"}
        </TableCell>
        <TableCell>
          <Badge className={cn("text-xs font-medium", DISPOSITION_BADGE[disposition] || "bg-secondary text-secondary-foreground")}>
            {disposition?.replace(/_/g, " ") || "-"}
          </Badge>
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/emergency/${visit.id}`}><Eye className="h-4 w-4" /></Link>
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Siren className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emergency Department</h1>
            <p className="text-sm text-muted-foreground">Triage, active cases, and ER management.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/emergency/new"><Plus className="mr-2 h-4 w-4" />New Visit</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Cases" value={activeVisits.length} icon={Activity} accent="info" />
        <StatsCard title="Triage Pending" value={triagePending} icon={Clock} accent="warning" />
        <StatsCard title="Stabilized" value={stabilizedCount} icon={Activity} accent="success" />
        <StatsCard title="Admitted from ER" value={admittedCount} icon={UserPlus} accent="destructive" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Cases ({activeVisits.length})</TabsTrigger>
          <TabsTrigger value="all">All Visits</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activeVisits.length === 0 ? (
                <MedicalEmptyState
                  illustration="ecg"
                  title="No active emergency cases"
                  description="Active emergency visits and triage cases will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Visit #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Triage Level</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Chief Complaint</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Arrival Mode</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Disposition</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeVisits.map(renderVisitRow)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search visits..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filtered.length === 0 ? (
                <MedicalEmptyState
                  illustration="ecg"
                  title="No emergency visits found"
                  description="Try adjusting your search query."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Visit #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Triage Level</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Chief Complaint</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Arrival Mode</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Disposition</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(renderVisitRow)}
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
