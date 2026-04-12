"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Pill, AlertTriangle, Package, Plus, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function stockVariant(qty: number, reorder: number): "success" | "warning" | "destructive" {
  if (qty <= 0) return "destructive";
  if (qty <= reorder) return "warning";
  return "success";
}

function stockLabel(qty: number, reorder: number): string {
  if (qty <= 0) return "Out of stock";
  if (qty <= reorder) return "Low stock";
  return "In stock";
}

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
  const outOfStock = drugs.filter((d) => (d.stockQuantity as number) === 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Pharmacy" description="Drug inventory and prescription dispensing">
        <Button asChild><Link href="/pharmacy/drugs/new"><Plus className="mr-2 h-4 w-4" />Add Drug</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Drugs" value={drugs.length} icon={Pill} accent="primary" />
        <StatsCard title="Low Stock" value={lowStock} icon={AlertTriangle} accent="warning" />
        <StatsCard title="Out of Stock" value={outOfStock} icon={Package} accent="destructive" />
        <StatsCard title="Pending Rx" value={pendingRx.length} icon={Pill} accent="info" />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Drug Inventory</TabsTrigger>
          <TabsTrigger value="dispense">Pending Prescriptions ({pendingRx.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drugs by name or generic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : drugs.length === 0 ? (
                <MedicalEmptyState
                  illustration="pill"
                  title="No drugs found"
                  description="Add drugs to your pharmacy inventory or try a different search."
                  action={{ label: "Add Drug", href: "/pharmacy/drugs/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Drug</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Category</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Stock Level</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Price</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drugs.map((drug) => {
                      const qty = drug.stockQuantity as number;
                      const reorder = drug.reorderLevel as number;
                      const maxStock = Math.max(qty, reorder * 3, 100);
                      const variant = stockVariant(qty, reorder);
                      return (
                        <TableRow key={drug.id as string} className="hover:bg-secondary/30 transition-colors">
                          <TableCell>
                            <div className="font-medium text-sm">{drug.name as string}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {drug.genericName as string} · {drug.strength as string} · {drug.dosageForm as string}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {drug.category as string}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 min-w-[140px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className={cn(
                                  "font-semibold tabular-nums",
                                  variant === "destructive" && "text-destructive",
                                  variant === "warning" && "text-warning",
                                  variant === "success" && "text-success",
                                )}>
                                  {qty}
                                </span>
                                <Badge
                                  className={cn(
                                    "text-[9px] px-1.5 py-0 border-0",
                                    variant === "destructive" && "bg-destructive/10 text-destructive",
                                    variant === "warning" && "bg-warning/10 text-warning",
                                    variant === "success" && "bg-success/10 text-success",
                                  )}
                                >
                                  {stockLabel(qty, reorder)}
                                </Badge>
                              </div>
                              <Progress value={qty} max={maxStock} variant={variant} />
                              <div className="text-[10px] text-muted-foreground">
                                Reorder at {reorder}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            ₹{Number(drug.unitPrice ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={drug.isActive ? "Active" : "Inactive"} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/pharmacy/drugs/${drug.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispense">
          <Card>
            <CardContent className="pt-6">
              {pendingRx.length === 0 ? (
                <MedicalEmptyState
                  illustration="pill"
                  title="No pending prescriptions"
                  description="When doctors sign prescriptions, they'll appear here for dispensing."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Rx #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRx.map((rx) => (
                      <TableRow key={rx.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{rx.prescriptionNo as string}</TableCell>
                        <TableCell>
                          {(rx.patient as Record<string, string>)?.firstName} {(rx.patient as Record<string, string>)?.lastName}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {new Date(rx.createdAt as string).toLocaleDateString()}
                        </TableCell>
                        <TableCell><StatusBadge status={rx.status as string} /></TableCell>
                        <TableCell>
                          <Button size="sm" asChild>
                            <Link href={`/pharmacy/dispense/${rx.id}`}>Dispense</Link>
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
