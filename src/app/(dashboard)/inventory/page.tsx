"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Truck, Plus } from "lucide-react";

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
  const totalValue = items.reduce((sum, i) => sum + ((i.currentStock as number) * (i.unitCost as number || 0)), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Management" description="Track items, stock levels, and suppliers">
        <Button asChild><Link href="/inventory/items/new"><Plus className="mr-2 h-4 w-4" />Add Item</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Items" value={items.length} icon={Package} />
        <StatsCard title="Low Stock Alerts" value={lowStock} icon={AlertTriangle} />
        <StatsCard title="Suppliers" value={suppliers.length} icon={Truck} />
        <StatsCard title="Total Value" value={`$${totalValue.toLocaleString()}`} icon={Package} />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader><Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : items.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No items found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id as string}>
                        <TableCell className="font-medium">{item.name as string}</TableCell>
                        <TableCell>{item.category as string}</TableCell>
                        <TableCell className={(item.currentStock as number) <= (item.reorderLevel as number) ? "text-red-600 font-bold" : ""}>
                          {item.currentStock as number} {item.unit as string}
                        </TableCell>
                        <TableCell>{item.reorderLevel as number}</TableCell>
                        <TableCell>${Number(item.unitCost ?? 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${(item.currentStock as number) <= (item.reorderLevel as number) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {(item.currentStock as number) <= (item.reorderLevel as number) ? "Low Stock" : "In Stock"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((sup) => (
                    <TableRow key={sup.id as string}>
                      <TableCell className="font-medium">{sup.companyName as string}</TableCell>
                      <TableCell>{sup.contactPerson as string}</TableCell>
                      <TableCell>{sup.email as string}</TableCell>
                      <TableCell>{sup.phone as string}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
