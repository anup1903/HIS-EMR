"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Package, Clock, AlertTriangle, Plus } from "lucide-react";

const STERILIZATION_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  STERILIZED: "bg-green-100 text-green-800",
  ISSUED: "bg-purple-100 text-purple-800",
  RETURNED: "bg-gray-100 text-gray-800",
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
    <div className="space-y-6">
      <PageHeader title="CSSD" description="Central Sterile Supply Department - Instrument sterilization tracking">
        <div className="flex gap-2">
          <Button asChild><Link href="/cssd/batches/new"><Plus className="mr-2 h-4 w-4" />New Batch</Link></Button>
          <Button variant="outline" asChild><Link href="/cssd/instruments/new">Add Instrument Set</Link></Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Instrument Sets" value={instruments.length} icon={Package} />
        <StatsCard title="Active Batches" value={activeBatches.length} icon={Clock} />
        <StatsCard title="Sterilized Ready" value={sterilizedCount} icon={ShieldCheck} />
        <StatsCard title="Failed Tests" value={failedCount} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Sterilization Batches ({batches.length})</TabsTrigger>
          <TabsTrigger value="instruments">Instrument Sets ({instruments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="batches">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : batches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sterilization batches</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch #</TableHead>
                      <TableHead>Instrument Set</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Load Date</TableHead>
                      <TableHead>Sterilized</TableHead>
                      <TableHead>BI Result</TableHead>
                      <TableHead>CI Result</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id as string}>
                        <TableCell className="font-medium">{batch.batchNo as string}</TableCell>
                        <TableCell>{(batch.instrumentSet as Record<string, string>)?.name || batch.instrumentSetId as string}</TableCell>
                        <TableCell>{(batch.method as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{new Date(batch.loadDate as string).toLocaleDateString()}</TableCell>
                        <TableCell>{batch.sterilizationDate ? new Date(batch.sterilizationDate as string).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          {batch.biIndicator ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${batch.biIndicator === "PASS" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {batch.biIndicator as string}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {batch.chemIndicator ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${batch.chemIndicator === "PASS" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {batch.chemIndicator as string}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STERILIZATION_COLORS[(batch.status as string)] || "bg-gray-100 text-gray-800"}`}>
                            {(batch.status as string)?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>{(batch.issuedTo as string) || "-"}</TableCell>
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
            <CardHeader><Input placeholder="Search instruments..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : instruments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No instrument sets registered</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Total Items</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instruments.filter((i) => `${i.name} ${i.code}`.toLowerCase().includes(search.toLowerCase())).map((inst) => (
                      <TableRow key={inst.id as string}>
                        <TableCell className="font-medium">{inst.code as string}</TableCell>
                        <TableCell>{inst.name as string}</TableCell>
                        <TableCell>{(inst.department as string) || "-"}</TableCell>
                        <TableCell>{inst.totalItems as number}</TableCell>
                        <TableCell><StatusBadge status={inst.isActive ? "ACTIVE" : "INACTIVE"} /></TableCell>
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
