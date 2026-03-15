"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Users, Package, AlertTriangle, Plus, Eye } from "lucide-react";

const BLOOD_GROUP_COLORS: Record<string, string> = {
  A_POSITIVE: "bg-red-100 text-red-800",
  A_NEGATIVE: "bg-red-50 text-red-700",
  B_POSITIVE: "bg-blue-100 text-blue-800",
  B_NEGATIVE: "bg-blue-50 text-blue-700",
  AB_POSITIVE: "bg-purple-100 text-purple-800",
  AB_NEGATIVE: "bg-purple-50 text-purple-700",
  O_POSITIVE: "bg-green-100 text-green-800",
  O_NEGATIVE: "bg-green-50 text-green-700",
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
      setInventory(invData.data || []);
      setDonors(donorData.data || []);
      setRequests(reqData.data || []);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Blood Bank" description="Blood inventory, donor management, and requests">
        <div className="flex gap-2">
          <Button asChild><Link href="/blood-bank/donors/new"><Plus className="mr-2 h-4 w-4" />Register Donor</Link></Button>
          <Button variant="outline" asChild><Link href="/blood-bank/requests/new">New Request</Link></Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Available Units" value={availableUnits} icon={Droplets} />
        <StatsCard title="Active Donors" value={donors.filter((d) => d.isActive).length} icon={Users} />
        <StatsCard title="Pending Requests" value={pendingRequests} icon={Package} />
        <StatsCard title="Expiring Soon" value={expiringCount} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory ({availableUnits})</TabsTrigger>
          <TabsTrigger value="donors">Donors ({donors.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader><CardTitle>Blood Inventory by Group</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                {["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"].map((bg) => {
                  const count = inventory.filter((i) => i.bloodGroup === bg && i.status === "AVAILABLE").length;
                  return (
                    <div key={bg} className={`rounded-lg p-4 text-center ${BLOOD_GROUP_COLORS[bg]}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm font-medium">{formatBloodGroup(bg)}</p>
                    </div>
                  );
                })}
              </div>
              {loading ? <p className="text-muted-foreground">Loading...</p> : inventory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No blood inventory records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bag #</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Volume (ml)</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.slice(0, 50).map((item) => (
                      <TableRow key={item.id as string}>
                        <TableCell className="font-medium">{item.bagNumber as string}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BLOOD_GROUP_COLORS[(item.bloodGroup as string)] || ""}`}>
                            {formatBloodGroup(item.bloodGroup as string)}
                          </span>
                        </TableCell>
                        <TableCell>{(item.component as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{item.volumeML as number}</TableCell>
                        <TableCell>{new Date(item.collectionDate as string).toLocaleDateString()}</TableCell>
                        <TableCell className={(new Date(item.expiryDate as string) <= new Date(Date.now() + 7 * 86400000)) ? "text-red-600 font-bold" : ""}>
                          {new Date(item.expiryDate as string).toLocaleDateString()}
                        </TableCell>
                        <TableCell><StatusBadge status={item.status as string} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="donors">
          <Card>
            <CardHeader><Input placeholder="Search donors..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : donors.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No donors registered</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Last Donation</TableHead>
                      <TableHead>Total Donations</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {donors.filter((d) => `${d.firstName} ${d.lastName} ${d.donorNo}`.toLowerCase().includes(search.toLowerCase())).map((donor) => (
                      <TableRow key={donor.id as string}>
                        <TableCell className="font-medium">{donor.donorNo as string}</TableCell>
                        <TableCell>{donor.firstName as string} {donor.lastName as string}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BLOOD_GROUP_COLORS[(donor.bloodGroup as string)] || ""}`}>
                            {formatBloodGroup(donor.bloodGroup as string)}
                          </span>
                        </TableCell>
                        <TableCell>{donor.phone as string}</TableCell>
                        <TableCell>{donor.lastDonationDate ? new Date(donor.lastDonationDate as string).toLocaleDateString() : "Never"}</TableCell>
                        <TableCell>{donor.totalDonations as number}</TableCell>
                        <TableCell><StatusBadge status={donor.isActive ? "ACTIVE" : "INACTIVE"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : requests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No blood requests</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Units Required</TableHead>
                      <TableHead>Units Issued</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id as string}>
                        <TableCell className="font-medium">{req.requestNo as string}</TableCell>
                        <TableCell>{(req.patient as Record<string, string>)?.firstName} {(req.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell>{formatBloodGroup(req.bloodGroup as string)}</TableCell>
                        <TableCell>{(req.component as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{req.unitsRequired as number}</TableCell>
                        <TableCell>{req.unitsIssued as number}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${req.urgency === "STAT" ? "bg-red-100 text-red-800" : req.urgency === "URGENT" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}>
                            {req.urgency as string}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={req.status as string} /></TableCell>
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
