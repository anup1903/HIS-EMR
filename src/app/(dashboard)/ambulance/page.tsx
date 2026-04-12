"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ambulance as AmbulanceIcon, MapPin, Clock, CheckCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const VEHICLE_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-success/10 text-success",
  ON_CALL: "bg-destructive/10 text-destructive",
  DISPATCHED: "bg-info/10 text-info",
  EN_ROUTE: "bg-warning/10 text-warning",
  AT_SCENE: "bg-warning/10 text-warning",
  RETURNING: "bg-warning/10 text-warning",
  MAINTENANCE: "bg-muted text-muted-foreground",
};

export default function AmbulanceManagementPage() {
  const [vehicles, setVehicles] = useState<Record<string, unknown>[]>([]);
  const [dispatches, setDispatches] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/ambulance/vehicles").then((r) => r.json()),
      fetch("/api/ambulance/dispatches").then((r) => r.json()),
    ]).then(([vData, dData]) => {
      setVehicles(vData.data || []);
      setDispatches(dData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const availableCount = vehicles.filter((v) => v.status === "AVAILABLE").length;
  const activeDispatches = dispatches.filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED");
  const todayTrips = dispatches.filter((d) => new Date(d.callTime as string).toDateString() === new Date().toDateString());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <AmbulanceIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Ambulance Management</h1>
            <p className="text-sm text-muted-foreground">Fleet tracking and dispatch management.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/ambulance/dispatch/new"><Plus className="mr-2 h-4 w-4" />New Dispatch</Link></Button>
          <Button variant="outline" asChild><Link href="/ambulance/vehicles/new">Add Vehicle</Link></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Fleet" value={vehicles.length} icon={AmbulanceIcon} accent="primary" />
        <StatsCard title="Available" value={availableCount} icon={CheckCircle} accent="success" />
        <StatsCard title="Active Dispatches" value={activeDispatches.length} icon={MapPin} accent="destructive" />
        <StatsCard title="Today's Trips" value={todayTrips.length} icon={Clock} accent="info" />
      </div>

      {/* Active Dispatch Board */}
      {activeDispatches.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Active Dispatches</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeDispatches.map((dispatch) => (
                <Card key={dispatch.id as string} className="stat-card border-2 border-primary/20 hover:border-primary/40 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold font-mono text-sm">{dispatch.dispatchNo as string}</span>
                      <StatusBadge status={dispatch.status as string} />
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium">{(dispatch.ambulance as Record<string, string>)?.vehicleNumber || dispatch.ambulanceId as string}</span></p>
                      <p><span className="text-muted-foreground">Pickup:</span> <span className="font-medium">{dispatch.pickupAddress as string}</span></p>
                      {dispatch.patientName ? <p><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{dispatch.patientName as string}</span></p> : null}
                      <p>
                        <span className="text-muted-foreground">Priority:</span>{" "}
                        <Badge className={cn(
                          "text-[10px] border-0 ml-1",
                          dispatch.priority === "URGENT" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                        )}>
                          {dispatch.priority as string}
                        </Badge>
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">Called: {new Date(dispatch.callTime as string).toLocaleTimeString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles ({vehicles.length})</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatch History</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : vehicles.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No vehicles registered"
                  description="Add ambulance vehicles to your fleet to start dispatching."
                  action={{ label: "Add Vehicle", href: "/ambulance/vehicles/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Vehicle #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Driver</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Driver Phone</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Paramedic</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{v.vehicleNumber as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(v.type as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{(v.driverName as string) || "-"}</TableCell>
                        <TableCell className="text-sm tabular-nums">{(v.driverPhone as string) || "-"}</TableCell>
                        <TableCell className="text-sm">{(v.paramedicName as string) || "-"}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            VEHICLE_STATUS_COLOR[(v.status as string)] || "bg-muted text-muted-foreground",
                          )}>
                            {(v.status as string)?.replace(/_/g, " ")}
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

        <TabsContent value="dispatches">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : dispatches.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No dispatch history"
                  description="Dispatch records will appear here once ambulances are dispatched."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Dispatch #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Vehicle</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Pickup</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Priority</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Call Time</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map((d) => (
                      <TableRow key={d.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{d.dispatchNo as string}</TableCell>
                        <TableCell>{(d.ambulance as Record<string, string>)?.vehicleNumber || "-"}</TableCell>
                        <TableCell className="text-sm">{(d.patientName as string) || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{d.pickupAddress as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(d.tripType as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            d.priority === "URGENT" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                          )}>
                            {d.priority as string}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{new Date(d.callTime as string).toLocaleString()}</TableCell>
                        <TableCell><StatusBadge status={d.status as string} /></TableCell>
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
