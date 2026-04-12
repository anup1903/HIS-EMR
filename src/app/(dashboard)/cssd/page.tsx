"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprayCan, Package, Clock, ShieldCheck, AlertTriangle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  STERILIZED: "bg-success/10 text-success",
  PROCESSING: "bg-warning/10 text-warning",
  IN_PROGRESS: "bg-warning/10 text-warning",
  PENDING: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/10 text-destructive",
  ISSUED: "bg-info/10 text-info",
  RETURNED: "bg-secondary text-secondary-foreground",
};

export default function CSSDPage() {
  const [instruments, setInstruments] = useState<Record<string, unknown>[]>([]);
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/cssd/instruments").then((r) => r.json()),
      fetch("/api/cssd/batches").then((r) => r.json()),
    ]).then(([instData, batchData]) => {
      setInstruments(instData.data || []);
      setBatches(batchData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const activeBatches = batches.filter((b) => b.status === "IN_PROGRESS" || b.status === "PENDING");
  const sterilizedCount = batches.filter((b) => b.status === "STERILIZED").length;
  const failedCount = batches.filter((b) => b.biIndicator === "FAIL" || b.chemIndicator === "FAIL").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SprayCan className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CSSD</h1>
            <p className="text-sm text-muted-foreground">Sterilization batches and instrument tracking.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/cssd/batches/new"><Plus className="mr-2 h-4 w-4" />New Batch</Link></Button>
          <Button variant="outline" asChild><Link href="/cssd/instruments/new">Add Instrument Set</Link></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Instrument Sets" value={instruments.length} icon={Package} accent="primary" />
        <StatsCard title="Active Batches" value={activeBatches.length} icon={Clock} accent="warning" />
        <StatsCard title="Sterilized Ready" value={sterilizedCount} icon={ShieldCheck} accent="success" />
        <StatsCard title="Failed Tests" value={failedCount} icon={AlertTriangle} accent="destructive" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Sterilization Batches ({batches.length})</TabsTrigger>
          <TabsTrigger value="instruments">Instrument Sets ({instruments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : batches.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No sterilization batches"
                  description="Create a new batch to start tracking sterilization cycles."
                  action={{ label: "New Batch", href: "/cssd/batches/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Batch #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Instrument Set</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Method</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Load Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Sterilized</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">BI Result</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">CI Result</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Issued To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{batch.batchNo as string}</TableCell>
                        <TableCell>{(batch.instrumentSet as Record<string, string>)?.name || batch.instrumentSetId as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(batch.method as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{new Date(batch.loadDate as string).toLocaleDateString()}</TableCell>
                        <TableCell className="tabular-nums">{batch.sterilizationDate ? new Date(batch.sterilizationDate as string).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          {batch.biIndicator ? (
                            <Badge className={cn(
                              "text-[10px] border-0",
                              batch.biIndicator === "PASS" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                            )}>
                              {batch.biIndicator as string}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {batch.chemIndicator ? (
                            <Badge className={cn(
                              "text-[10px] border-0",
                              batch.chemIndicator === "PASS" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                            )}>
                              {batch.chemIndicator as string}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            STATUS_COLOR[(batch.status as string)] || "bg-muted text-muted-foreground",
                          )}>
                            {(batch.status as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{(batch.issuedTo as string) || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instruments">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search instruments..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : instruments.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No instrument sets registered"
                  description="Add instrument sets to track sterilization cycles."
                  action={{ label: "Add Instrument Set", href: "/cssd/instruments/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Code</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Total Items</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instruments.filter((i) => `${i.name} ${i.code}`.toLowerCase().includes(search.toLowerCase())).map((inst) => (
                      <TableRow key={inst.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{inst.code as string}</TableCell>
                        <TableCell>{inst.name as string}</TableCell>
                        <TableCell className="text-sm">{(inst.department as string) || "-"}</TableCell>
                        <TableCell className="tabular-nums">{inst.totalItems as number}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            inst.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                          )}>
                            {inst.isActive ? "Active" : "Inactive"}
                          </Badge>
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
