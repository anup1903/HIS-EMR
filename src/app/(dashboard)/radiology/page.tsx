"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan, ClipboardList, CheckCircle, Clock, Eye } from "lucide-react";

export default function RadiologyPage() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [modalities, setModalities] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/radiology/orders").then((r) => r.json()),
      fetch("/api/radiology/modalities").then((r) => r.json()),
    ]).then(([oData, mData]) => {
      setOrders(oData.data || []);
      setModalities(mData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const pending = orders.filter((o) => o.status === "PENDING").length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Radiology" description="Imaging orders and results" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Orders" value={orders.length} icon={ClipboardList} />
        <StatsCard title="Pending" value={pending} icon={Clock} />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} />
        <StatsCard title="Modalities" value={modalities.length} icon={Scan} />
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Imaging Orders</TabsTrigger>
          <TabsTrigger value="modalities">Modalities</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No imaging orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Modality</TableHead>
                      <TableHead>Exam Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id as string}>
                        <TableCell className="font-medium">{order.orderNo as string}</TableCell>
                        <TableCell>{(order.patient as Record<string, string>)?.firstName} {(order.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell>{(order.modality as Record<string, string>)?.name}</TableCell>
                        <TableCell>{order.examType as string}</TableCell>
                        <TableCell>{new Date(order.createdAt as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={order.status as string} /></TableCell>
                        <TableCell><Button variant="ghost" size="sm" asChild><Link href={`/radiology/orders/${order.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modalities">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalities.map((mod) => (
                    <TableRow key={mod.id as string}>
                      <TableCell className="font-medium">{mod.name as string}</TableCell>
                      <TableCell>{mod.code as string}</TableCell>
                      <TableCell>{(mod.description as string) || "N/A"}</TableCell>
                      <TableCell><StatusBadge status={mod.isActive ? "Active" : "Inactive"} /></TableCell>
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
