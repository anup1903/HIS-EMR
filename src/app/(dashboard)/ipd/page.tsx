"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BedDouble,
  Users,
  Plus,
  Eye,
  Activity,
  AlertTriangle,
  Search,
  Filter,
  Hospital,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BedInfo {
  id: string;
  bedNumber: string;
  status: string;
}

interface WardInfo {
  id: string;
  name: string;
  type: string;
  floor: number;
  totalBeds: number;
  beds: BedInfo[];
  department?: { name: string };
}

export default function IPDPage() {
  const [admissions, setAdmissions] = useState<Record<string, unknown>[]>([]);
  const [wards, setWards] = useState<WardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/ipd/admissions?status=ADMITTED").then((r) => r.json()),
      fetch("/api/ipd/beds").then((r) => r.json()),
    ]).then(([aData, bData]) => {
      setAdmissions(aData.data || []);
      setBeds(bData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  function setBeds(data: unknown) {
    const arr = Array.isArray(data) ? data : [];
    setWards(arr as WardInfo[]);
  }

  // Stats
  const stats = useMemo(() => {
    let total = 0, occupied = 0, available = 0, maintenance = 0;
    for (const w of wards) {
      const beds = w.beds || [];
      total += beds.length;
      occupied += beds.filter((b) => b.status === "OCCUPIED").length;
      available += beds.filter((b) => b.status === "AVAILABLE").length;
      maintenance += beds.filter((b) => b.status === "MAINTENANCE").length;
    }
    return { total, occupied, available, maintenance, critical: admissions.length };
  }, [wards, admissions]);

  // Ward search filter
  const filteredWards = useMemo(() => {
    if (!search.trim()) return wards;
    const q = search.toLowerCase();
    return wards.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.type?.toLowerCase().includes(q) ||
        w.department?.name?.toLowerCase().includes(q),
    );
  }, [wards, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with icon badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Hospital className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inpatient Department</h1>
            <p className="text-sm text-muted-foreground">Ward management and bed allocation.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/ipd/admit">
            <Plus className="mr-2 h-4 w-4" />
            Admit Patient
          </Link>
        </Button>
      </div>

      {/* Stat cards — centered numbers like Lovable */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatTile label="Total Beds" value={stats.total} />
        <StatTile label="Occupied" value={stats.occupied} color="text-primary" />
        <StatTile label="Available" value={stats.available} color="text-success" />
        <StatTile label="Critical" value={stats.critical} color="text-destructive" />
      </div>

      <Tabs defaultValue="wards">
        <TabsList>
          <TabsTrigger value="wards">Ward Overview</TabsTrigger>
          <TabsTrigger value="admissions">Current Admissions ({admissions.length})</TabsTrigger>
        </TabsList>

        {/* Ward grid (Lovable-style) */}
        <TabsContent value="wards" className="space-y-4">
          {/* Search + Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inpatient department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-card"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>

          {/* Ward cards grid */}
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading wards...</p>
          ) : filteredWards.length === 0 ? (
            <MedicalEmptyState
              illustration="bed"
              title="No wards found"
              description="Set up wards and beds in the IPD configuration."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredWards.map((ward) => (
                <WardCard key={ward.id} ward={ward} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Admissions table */}
        <TabsContent value="admissions">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : admissions.length === 0 ? (
                <MedicalEmptyState
                  illustration="bed"
                  title="No active admissions"
                  description="When patients are admitted, they'll appear here."
                  action={{ label: "Admit Patient", href: "/ipd/admit" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Admission #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Ward / Bed</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Doctor</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Admitted On</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissions.map((adm) => (
                      <TableRow key={adm.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-mono text-sm font-medium">{adm.admissionNo as string}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {(adm.patient as Record<string, string>)?.firstName} {(adm.patient as Record<string, string>)?.lastName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            MRN {(adm.patient as Record<string, string>)?.mrn}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {(adm.bed as Record<string, unknown> & { ward?: Record<string, string> })?.ward?.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Bed {(adm.bed as Record<string, string>)?.bedNumber}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          Dr. {(adm.doctor as Record<string, Record<string, string>>)?.user?.name}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {new Date(adm.admissionDate as string).toLocaleDateString()}
                        </TableCell>
                        <TableCell><StatusBadge status={adm.status as string} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/ipd/admissions/${adm.id}`}><Eye className="h-4 w-4" /></Link>
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

/* ─────────── Stat tile (centered, large number) ─────────── */
function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card className="stat-card">
      <CardContent className="pt-5 pb-4 text-center">
        <div className={cn("text-3xl font-bold tabular-nums tracking-tight", color)}>
          {value}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

/* ─────────── Ward card with progress bar + critical badge ─────────── */
function WardCard({ ward }: { ward: WardInfo }) {
  const beds = ward.beds || [];
  const total = beds.length;
  const occupied = beds.filter((b) => b.status === "OCCUPIED").length;
  const available = beds.filter((b) => b.status === "AVAILABLE").length;
  const maintenance = beds.filter((b) => b.status === "MAINTENANCE").length;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  // "Critical" = maintenance + any that are occupied above 80% capacity
  const criticalCount = maintenance;

  const variant: "success" | "warning" | "destructive" =
    pct >= 90 ? "destructive" : pct >= 70 ? "warning" : "success";

  return (
    <Card className="stat-card overflow-hidden">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">{ward.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {ward.department?.name || ward.type} · Floor {ward.floor}
            </p>
          </div>
          {criticalCount > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              {criticalCount} critical
            </Badge>
          )}
        </div>

        <Progress value={occupied} max={total} variant={variant} className="h-2.5" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">{occupied}</span>/{total} occupied
          </span>
          <span className={cn(
            "font-medium tabular-nums",
            available > 0 ? "text-success" : "text-destructive",
          )}>
            {available} available
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
