"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, ClipboardList, CheckCircle, Clock, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, { cls: string; label: string }> = {
  STAT: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "STAT" },
  URGENT: { cls: "bg-warning/10 text-warning border-warning/30", label: "Urgent" },
  ROUTINE: { cls: "bg-muted text-muted-foreground", label: "Routine" },
};

export default function LaboratoryPage() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [tests, setTests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filteredTests = tests.filter((t) =>
    !search ||
    (t.name as string)?.toLowerCase().includes(search.toLowerCase()) ||
    (t.code as string)?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Laboratory" description="Lab orders, tests, and results" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Orders" value={orders.length} icon={ClipboardList} accent="primary" />
        <StatsCard title="Pending" value={pending} icon={Clock} accent="warning" />
        <StatsCard title="In Progress" value={inProgress} icon={FlaskConical} accent="info" />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} accent="success" />
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Lab Orders</TabsTrigger>
          <TabsTrigger value="catalog">Test Catalog ({tests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : orders.length === 0 ? (
                <MedicalEmptyState
                  illustration="lab"
                  title="No lab orders"
                  description="When doctors order tests, they'll appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Order #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Priority</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Tests</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const priority = (order.priority as string) || "ROUTINE";
                      const pStyle = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.ROUTINE;
                      return (
                        <TableRow key={order.id as string} className="hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-mono text-sm font-medium">{order.orderNo as string}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {(order.patient as Record<string, string>)?.firstName} {(order.patient as Record<string, string>)?.lastName}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              MRN {(order.patient as Record<string, string>)?.mrn}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] font-semibold border", pStyle.cls)}>
                              {pStyle.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {((order.items as unknown[]) || []).length} test{((order.items as unknown[]) || []).length !== 1 ? "s" : ""}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {new Date(order.createdAt as string).toLocaleDateString()}
                          </TableCell>
                          <TableCell><StatusBadge status={order.status as string} /></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/laboratory/orders/${order.id}`}>
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

        <TabsContent value="catalog">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-[11px] uppercase tracking-wider">Test Name</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Code</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Category</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Sample</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Price</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">TAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((test) => (
                    <TableRow key={test.id as string} className="hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-medium">{test.name as string}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {test.code as string}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {test.category as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{(test.sampleType as string) || "—"}</TableCell>
                      <TableCell className="tabular-nums font-medium">
                        ₹{Number(test.price ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{test.turnaroundTime as string}</TableCell>
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
