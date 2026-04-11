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
import { Ambulance as AmbulanceIcon, MapPin, Clock, CheckCircle, Plus } from "lucide-react";

const AMBULANCE_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  DISPATCHED: "bg-blue-100 text-blue-800",
  EN_ROUTE: "bg-yellow-100 text-yellow-800",
  AT_SCENE: "bg-orange-100 text-orange-800",
  RETURNING: "bg-purple-100 text-purple-800",
  MAINTENANCE: "bg-gray-100 text-gray-800",
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
    <div className="space-y-6">
      <PageHeader title="Ambulance Management" description="Fleet management and dispatch tracking">
        <div className="flex gap-2">
          <Button asChild><Link href="/ambulance/dispatch/new"><Plus className="mr-2 h-4 w-4" />New Dispatch</Link></Button>
          <Button variant="outline" asChild><Link href="/ambulance/vehicles/new">Add Vehicle</Link></Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Fleet" value={vehicles.length} icon={AmbulanceIcon} />
        <StatsCard title="Available" value={availableCount} icon={CheckCircle} />
        <StatsCard title="Active Dispatches" value={activeDispatches.length} icon={MapPin} />
        <StatsCard title="Today's Trips" value={todayTrips.length} icon={Clock} />
      </div>

      {/* Active Dispatch Board */}
      {activeDispatches.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Active Dispatches</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeDispatches.map((dispatch) => (
                <Card key={dispatch.id as string} className="border-2 border-blue-300">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold">{dispatch.dispatchNo as string}</span>
                      <StatusBadge status={dispatch.status as string} />
                    </div>
                    <p className="text-sm"><strong>Vehicle:</strong> {(dispatch.ambulance as Record<string, string>)?.vehicleNumber || dispatch.ambulanceId as string}</p>
                    <p className="text-sm"><strong>Pickup:</strong> {dispatch.pickupAddress as string}</p>
                    {dispatch.patientName ? <p className="text-sm"><strong>Patient:</strong> {dispatch.patientName as string}</p> : null}
                    <p className="text-sm"><strong>Priority:</strong> <span className={dispatch.priority === "URGENT" ? "text-red-600 font-bold" : ""}>{dispatch.priority as string}</span></p>
                    <p className="text-xs text-muted-foreground mt-2">Called: {new Date(dispatch.callTime as string).toLocaleTimeString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles ({vehicles.length})</TabsTrigger>
          <TabsTrigger value="dispatches">Dispatch History</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : vehicles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No vehicles registered</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Driver Phone</TableHead>
                      <TableHead>Paramedic</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => (
                      <TableRow key={v.id as string}>
                        <TableCell className="font-medium">{v.vehicleNumber as string}</TableCell>
                        <TableCell>{(v.type as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{(v.driverName as string) || "-"}</TableCell>
                        <TableCell>{(v.driverPhone as string) || "-"}</TableCell>
                        <TableCell>{(v.paramedicName as string) || "-"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${AMBULANCE_STATUS_COLORS[(v.status as string)] || "bg-gray-100 text-gray-800"}`}>
                            {(v.status as string)?.replace(/_/g, " ")}
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

        <TabsContent value="dispatches">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : dispatches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No dispatch history</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispatch #</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Call Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map((d) => (
                      <TableRow key={d.id as string}>
                        <TableCell className="font-medium">{d.dispatchNo as string}</TableCell>
                        <TableCell>{(d.ambulance as Record<string, string>)?.vehicleNumber || "-"}</TableCell>
                        <TableCell>{(d.patientName as string) || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{d.pickupAddress as string}</TableCell>
                        <TableCell>{(d.tripType as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${d.priority === "URGENT" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                            {d.priority as string}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(d.callTime as string).toLocaleString()}</TableCell>
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
