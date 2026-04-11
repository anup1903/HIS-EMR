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
import { Pill, AlertTriangle, Package, Plus, Eye } from "lucide-react";

export default function PharmacyPage() {
  const [drugs, setDrugs] = useState<Record<string, unknown>[]>([]);
  const [pendingRx, setPendingRx] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/pharmacy/drugs?search=${search}`).then((r) => r.json()),
      fetch("/api/pharmacy/dispense").then((r) => r.json()),
    ]).then(([dData, rxData]) => {
      setDrugs(dData.data || []);
      setPendingRx(rxData.data || []);
    }).finally(() => setLoading(false));
  }, [search]);

  const lowStock = drugs.filter((d) => (d.stockQuantity as number) <= (d.reorderLevel as number)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Pharmacy" description="Drug inventory and prescription dispensing">
        <Button asChild><Link href="/pharmacy/drugs/new"><Plus className="mr-2 h-4 w-4" />Add Drug</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Drugs" value={drugs.length} icon={Pill} />
        <StatsCard title="Low Stock Alerts" value={lowStock} icon={AlertTriangle} />
        <StatsCard title="Pending Dispensing" value={pendingRx.length} icon={Package} />
        <StatsCard title="Categories" value={new Set(drugs.map((d) => d.category)).size} icon={Pill} />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Drug Inventory</TabsTrigger>
          <TabsTrigger value="dispense">Pending Prescriptions ({pendingRx.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader><Input placeholder="Search drugs..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : drugs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No drugs found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Generic Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drugs.map((drug) => (
                      <TableRow key={drug.id as string}>
                        <TableCell className="font-medium">{drug.name as string}</TableCell>
                        <TableCell>{drug.genericName as string}</TableCell>
                        <TableCell>{drug.category as string}</TableCell>
                        <TableCell className={((drug.stockQuantity as number) <= (drug.reorderLevel as number)) ? "text-red-600 font-bold" : ""}>
                          {drug.stockQuantity as number} {drug.dosageForm as string}
                        </TableCell>
                        <TableCell>${Number(drug.unitPrice ?? 0).toFixed(2)}</TableCell>
                        <TableCell><StatusBadge status={drug.isActive ? "Active" : "Inactive"} /></TableCell>
                        <TableCell><Button variant="ghost" size="sm" asChild><Link href={`/pharmacy/drugs/${drug.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispense">
          <Card>
            <CardContent className="pt-6">
              {pendingRx.length === 0 ? <p className="text-muted-foreground text-center py-8">No pending prescriptions</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prescription #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRx.map((rx) => (
                      <TableRow key={rx.id as string}>
                        <TableCell className="font-medium">{rx.prescriptionNo as string}</TableCell>
                        <TableCell>{(rx.patient as Record<string, string>)?.firstName} {(rx.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell>Dr. {(rx.doctor as Record<string, Record<string, string>>)?.user?.name}</TableCell>
                        <TableCell>{new Date(rx.createdAt as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={rx.status as string} /></TableCell>
                        <TableCell><Button size="sm" asChild><Link href={`/pharmacy/dispense/${rx.id}`}>Dispense</Link></Button></TableCell>
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
