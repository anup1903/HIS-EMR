"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScanLine, ClipboardList, CheckCircle, Clock, Eye, Search, Activity, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RadiologyPage() {
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [modalities, setModalities] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
  const inProgress = orders.filter((o) => o.status === "IN_PROGRESS").length;
  const completed = orders.filter((o) => o.status === "COMPLETED").length;

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const patient = o.patient as Record<string, string> | undefined;
    return (
      (o.orderNo as string)?.toLowerCase().includes(s) ||
      (patient?.firstName || "").toLowerCase().includes(s) ||
      (patient?.lastName || "").toLowerCase().includes(s) ||
      (o.examType as string)?.toLowerCase().includes(s)
    );
  });

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      STAT: "bg-destructive/10 text-destructive",
      URGENT: "bg-warning/10 text-warning",
      ROUTINE: "bg-muted text-muted-foreground",
    };
    return (
      <Badge className={cn("text-[10px] border-0", map[priority] || "bg-muted text-muted-foreground")}>
        {priority || "ROUTINE"}
      </Badge>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-warning/10 text-warning",
      IN_PROGRESS: "bg-info/10 text-info",
      COMPLETED: "bg-success/10 text-success",
      CANCELLED: "bg-destructive/10 text-destructive",
    };
    return (
      <Badge className={cn("text-[10px] border-0", map[status] || "bg-muted text-muted-foreground")}>
        {status?.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Radiology</h1>
            <p className="text-sm text-muted-foreground">Imaging orders, modalities, and reports.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/radiology/orders/new">
            <Plus className="mr-2 h-4 w-4" />New Order
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Orders" value={orders.length} icon={ClipboardList} accent="primary" />
        <StatsCard title="Pending" value={pending} icon={Clock} accent="warning" />
        <StatsCard title="In Progress" value={inProgress} icon={Activity} accent="info" />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} accent="success" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Imaging Orders</TabsTrigger>
          <TabsTrigger value="modalities">Modalities</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders by ID, patient, or exam type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : filteredOrders.length === 0 ? (
                <MedicalEmptyState
                  illustration="ecg"
                  title="No imaging orders found"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Order #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Modality</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Exam Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Priority</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">{order.orderNo as string}</TableCell>
                        <TableCell>
                          {(order.patient as Record<string, string>)?.firstName}{" "}
                          {(order.patient as Record<string, string>)?.lastName}
                        </TableCell>
                        <TableCell>{(order.modality as Record<string, string>)?.name}</TableCell>
                        <TableCell>{order.examType as string}</TableCell>
                        <TableCell>{priorityBadge((order.priority as string) || "ROUTINE")}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(order.createdAt as string).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{statusBadge(order.status as string)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/radiology/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
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

        <TabsContent value="modalities">
          <Card>
            <CardContent className="pt-6">
              {modalities.length === 0 ? (
                <MedicalEmptyState
                  illustration="ecg"
                  title="No modalities configured"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Code</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Description</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modalities.map((mod) => (
                      <TableRow key={mod.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">{mod.name as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{mod.code as string}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{(mod.description as string) || "N/A"}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            mod.isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          )}>
                            {mod.isActive ? "Active" : "Inactive"}
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
