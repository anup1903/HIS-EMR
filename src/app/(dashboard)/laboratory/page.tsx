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
import { FlaskConical, ClipboardList, CheckCircle, Clock, Eye } from "lucide-react";

export default function LaboratoryPage() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [tests, setTests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/laboratory/orders").then((r) => r.json()),
      fetch("/api/laboratory/tests").then((r) => r.json()),
    ]).then(([oData, tData]) => {
      setOrders(oData.data || []);
      setTests(tData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const pending = orders.filter((o) => o.status === "PENDING").length;
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Laboratory" description="Lab orders, tests, and results" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Orders" value={orders.length} icon={ClipboardList} />
        <StatsCard title="Pending" value={pending} icon={Clock} />
        <StatsCard title="In Progress" value={inProgress} icon={FlaskConical} />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} />
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Lab Orders</TabsTrigger>
          <TabsTrigger value="catalog">Test Catalog ({tests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No lab orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Tests</TableHead>
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
                        <TableCell>{order.orderedBy as string}</TableCell>
                        <TableCell>{((order.items as unknown[]) || []).length} test(s)</TableCell>
                        <TableCell>{new Date(order.createdAt as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={order.status as string} /></TableCell>
                        <TableCell><Button variant="ghost" size="sm" asChild><Link href={`/laboratory/orders/${order.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => (
                    <TableRow key={test.id as string}>
                      <TableCell className="font-medium">{test.name as string}</TableCell>
                      <TableCell>{test.code as string}</TableCell>
                      <TableCell>{test.category as string}</TableCell>
                      <TableCell>${Number(test.price ?? 0).toFixed(2)}</TableCell>
                      <TableCell>{test.turnaroundTime as string}</TableCell>
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
