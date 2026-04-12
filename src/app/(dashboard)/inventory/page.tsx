"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Package, AlertTriangle, Truck, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

function stockVariant(qty: number, reorder: number): "success" | "warning" | "destructive" {
  if (qty <= 0) return "destructive";
  if (qty <= reorder) return "warning";
  return "success";
}

export default function InventoryPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/inventory/items?search=${search}`).then((r) => r.json()),
      fetch("/api/inventory/suppliers").then((r) => r.json()),
    ]).then(([iData, sData]) => {
      setItems(iData.data || []);
      setSuppliers(sData.data || []);
    }).finally(() => setLoading(false));
  }, [search]);

  const lowStock = items.filter((i) => (i.currentStock as number) <= (i.reorderLevel as number)).length;
  const totalValue = items.reduce((sum, i) => sum + ((i.currentStock as number) * Number(i.unitCost ?? 0)), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Inventory Management" description="Track items, stock levels, and suppliers">
        <Button asChild><Link href="/inventory/items/new"><Plus className="mr-2 h-4 w-4" />Add Item</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Items" value={items.length} icon={Package} accent="primary" />
        <StatsCard title="Low Stock" value={lowStock} icon={AlertTriangle} accent="warning" />
        <StatsCard title="Suppliers" value={suppliers.length} icon={Truck} accent="info" />
        <StatsCard title="Total Value" value={`₹${totalValue.toLocaleString()}`} icon={Package} accent="success" />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers ({suppliers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : items.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No items found"
                  description="Add items to your inventory."
                  action={{ label: "Add Item", href: "/inventory/items/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Item</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Category</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Stock Level</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Unit Cost</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const qty = item.currentStock as number;
                      const reorder = item.reorderLevel as number;
                      const maxStock = Math.max(qty, reorder * 3, 50);
                      const variant = stockVariant(qty, reorder);
                      return (
                        <TableRow key={item.id as string} className="hover:bg-secondary/30 transition-colors">
                          <TableCell>
                            <div className="font-medium text-sm">{item.name as string}</div>
                            <div className="text-[11px] text-muted-foreground">{(item.unit as string) || "units"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">{item.category as string}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className={cn(
                                  "font-semibold tabular-nums",
                                  variant === "destructive" && "text-destructive",
                                  variant === "warning" && "text-warning",
                                  variant === "success" && "text-success",
                                )}>
                                  {qty}
                                </span>
                                <span className="text-[10px] text-muted-foreground">/ {reorder} min</span>
                              </div>
                              <Progress value={qty} max={maxStock} variant={variant} />
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            ₹{Number(item.unitCost ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[10px] border-0",
                                variant === "destructive" && "bg-destructive/10 text-destructive",
                                variant === "warning" && "bg-warning/10 text-warning",
                                variant === "success" && "bg-success/10 text-success",
                              )}
                            >
                              {qty <= 0 ? "Out of stock" : qty <= reorder ? "Low stock" : "In stock"}
                            </Badge>
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

        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              {suppliers.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No suppliers registered"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Company</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Contact</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((sup) => (
                      <TableRow key={sup.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">{sup.companyName as string}</TableCell>
                        <TableCell>{sup.contactPerson as string}</TableCell>
                        <TableCell>{sup.email as string}</TableCell>
                        <TableCell className="tabular-nums">{sup.phone as string}</TableCell>
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
