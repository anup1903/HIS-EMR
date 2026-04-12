"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Users, Package, AlertTriangle, Plus, Search } from "lucide-react";

const BLOOD_GROUP_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  A_POSITIVE:  { bg: "bg-red-50",    text: "text-red-700",    accent: "bg-red-500" },
  A_NEGATIVE:  { bg: "bg-red-50",    text: "text-red-600",    accent: "bg-red-400" },
  B_POSITIVE:  { bg: "bg-blue-50",   text: "text-blue-700",   accent: "bg-blue-500" },
  B_NEGATIVE:  { bg: "bg-blue-50",   text: "text-blue-600",   accent: "bg-blue-400" },
  AB_POSITIVE: { bg: "bg-purple-50", text: "text-purple-700", accent: "bg-purple-500" },
  AB_NEGATIVE: { bg: "bg-purple-50", text: "text-purple-600", accent: "bg-purple-400" },
  O_POSITIVE:  { bg: "bg-green-50",  text: "text-green-700",  accent: "bg-green-500" },
  O_NEGATIVE:  { bg: "bg-green-50",  text: "text-green-600",  accent: "bg-green-400" },
};

const REQUEST_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-info/10 text-info",
  ISSUED: "bg-success/10 text-success",
  FULFILLED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
  REJECTED: "bg-destructive/10 text-destructive",
};

const URGENCY_STYLES: Record<string, string> = {
  STAT: "bg-destructive/10 text-destructive",
  URGENT: "bg-warning/10 text-warning",
  ROUTINE: "bg-secondary text-secondary-foreground",
};

function formatBloodGroup(bg: string) {
  return bg?.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-");
}

export default function BloodBankPage() {
  const [inventory, setInventory] = useState<Record<string, unknown>[]>([]);
  const [donors, setDonors] = useState<Record<string, unknown>[]>([]);
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/blood-bank/inventory").then((r) => r.json()),
      fetch("/api/blood-bank/donors").then((r) => r.json()),
      fetch("/api/blood-bank/requests").then((r) => r.json()),
    ]).then(([invData, donorData, reqData]) => {
      const invPayload = invData?.data;
      setInventory(
        Array.isArray(invPayload)
          ? invPayload
          : Array.isArray(invPayload?.inventory)
            ? invPayload.inventory
            : [],
      );
      const donorPayload = donorData?.data;
      setDonors(
        Array.isArray(donorPayload)
          ? donorPayload
          : Array.isArray(donorPayload?.donors)
            ? donorPayload.donors
            : [],
      );
      const reqPayload = reqData?.data;
      setRequests(
        Array.isArray(reqPayload)
          ? reqPayload
          : Array.isArray(reqPayload?.requests)
            ? reqPayload.requests
            : [],
      );
    }).finally(() => setLoading(false));
  }, []);

  const availableUnits = inventory.filter((i) => i.status === "AVAILABLE").length;
  const pendingRequests = requests.filter((r) => r.status === "PENDING").length;
  const expiringCount = inventory.filter((i) => {
    const expiry = new Date(i.expiryDate as string);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return i.status === "AVAILABLE" && expiry <= weekFromNow;
  }).length;

  // Group inventory by blood group for grid cards
  const BLOOD_GROUPS = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"];
  const maxUnitsPerGroup = Math.max(
    ...BLOOD_GROUPS.map((bg) => inventory.filter((i) => i.bloodGroup === bg && i.status === "AVAILABLE").length),
    1,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Droplets className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Blood Bank</h1>
            <p className="text-sm text-muted-foreground">Inventory, donors, and transfusion requests.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/blood-bank/donors/new"><Plus className="mr-2 h-4 w-4" />Register Donor</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/blood-bank/requests/new">New Request</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Available Units" value={availableUnits} icon={Droplets} accent="primary" />
        <StatsCard title="Active Donors" value={donors.filter((d) => d.isActive).length} icon={Users} accent="success" />
        <StatsCard title="Pending Requests" value={pendingRequests} icon={Package} accent="warning" />
        <StatsCard title="Expiring Soon" value={expiringCount} icon={AlertTriangle} accent="destructive" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory ({availableUnits})</TabsTrigger>
          <TabsTrigger value="donors">Donors ({donors.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
        </TabsList>

        {/* ─── Inventory Tab: Grid Cards ─── */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle>Blood Inventory by Group</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : inventory.length === 0 ? (
                <MedicalEmptyState
                  illustration="lab"
                  title="No blood inventory records"
                  description="Blood units will appear here once added to inventory."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {BLOOD_GROUPS.map((bg) => {
                    const items = inventory.filter((i) => i.bloodGroup === bg && i.status === "AVAILABLE");
                    const count = items.length;
                    const colors = BLOOD_GROUP_COLORS[bg] || { bg: "bg-gray-50", text: "text-gray-700", accent: "bg-gray-500" };
                    // Find the component and nearest expiry from available items
                    const components = [...new Set(items.map((i) => (i.component as string)?.replace(/_/g, " ")))].filter(Boolean);
                    const nearestExpiry = items
                      .map((i) => new Date(i.expiryDate as string))
                      .sort((a, b) => a.getTime() - b.getTime())[0];
                    const progressValue = maxUnitsPerGroup > 0 ? (count / maxUnitsPerGroup) * 100 : 0;

                    return (
                      <Card key={bg} className={cn("border overflow-hidden", colors.bg)}>
                        <CardContent className="p-5">
                          <div className="flex items-baseline justify-between mb-2">
                            <span className={cn("text-3xl font-bold tabular-nums", colors.text)}>
                              {formatBloodGroup(bg)}
                            </span>
                            <span className={cn("text-2xl font-semibold tabular-nums", colors.text)}>
                              {count}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {count === 1 ? "1 unit" : `${count} units`} available
                          </p>
                          {components.length > 0 && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {components.slice(0, 2).join(", ")}
                              {components.length > 2 && ` +${components.length - 2} more`}
                            </p>
                          )}
                          {nearestExpiry && (
                            <p className={cn(
                              "text-xs mb-3",
                              nearestExpiry <= new Date(Date.now() + 7 * 86400000) ? "text-destructive font-medium" : "text-muted-foreground",
                            )}>
                              Nearest expiry: {nearestExpiry.toLocaleDateString()}
                            </p>
                          )}
                          <Progress value={progressValue} className="h-1.5" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Donors Tab ─── */}
        <TabsContent value="donors">
          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search donors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : donors.length === 0 ? (
                <MedicalEmptyState
                  illustration="stethoscope"
                  title="No donors registered"
                  description="Registered blood donors will appear here."
                  action={{ label: "Register Donor", href: "/blood-bank/donors/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Donor</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Blood Group</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Phone</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Last Donation</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Total</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donors
                      .filter((d) =>
                        `${d.firstName} ${d.lastName} ${d.donorNo}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((donor) => {
                        const initials = `${(donor.firstName as string)?.[0] || ""}${(donor.lastName as string)?.[0] || ""}`.toUpperCase();
                        const bgColor = BLOOD_GROUP_COLORS[(donor.bloodGroup as string)];
                        return (
                          <TableRow key={donor.id as string} className="hover:bg-secondary/30 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                                  bgColor ? `${bgColor.bg} ${bgColor.text}` : "bg-secondary text-secondary-foreground",
                                )}>
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-medium">{donor.firstName as string} {donor.lastName as string}</span>
                                  <p className="text-xs text-muted-foreground">{donor.donorNo as string}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "text-xs font-medium",
                                bgColor ? `${bgColor.bg} ${bgColor.text}` : "bg-secondary text-secondary-foreground",
                              )}>
                                {formatBloodGroup(donor.bloodGroup as string)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{donor.phone as string}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {donor.lastDonationDate
                                ? new Date(donor.lastDonationDate as string).toLocaleDateString()
                                : "Never"}
                            </TableCell>
                            <TableCell className="font-medium tabular-nums">{donor.totalDonations as number}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "text-xs font-medium",
                                donor.isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                              )}>
                                {donor.isActive ? "Active" : "Inactive"}
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

        {/* ─── Requests Tab ─── */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : requests.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No blood requests"
                  description="Transfusion requests will appear here."
                  action={{ label: "New Request", href: "/blood-bank/requests/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Request #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Blood Group</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Component</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Required</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Issued</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Urgency</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">{req.requestNo as string}</TableCell>
                        <TableCell>
                          {(req.patient as Record<string, string>)?.firstName}{" "}
                          {(req.patient as Record<string, string>)?.lastName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {formatBloodGroup(req.bloodGroup as string)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(req.component as string)?.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">{req.unitsRequired as number}</TableCell>
                        <TableCell className="tabular-nums">{req.unitsIssued as number}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-xs font-medium",
                            URGENCY_STYLES[(req.urgency as string)] || "bg-secondary text-secondary-foreground",
                          )}>
                            {req.urgency as string}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-xs font-medium",
                            REQUEST_STATUS_STYLES[(req.status as string)] || "bg-secondary text-secondary-foreground",
                          )}>
                            {(req.status as string)?.replace(/_/g, " ")}
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
