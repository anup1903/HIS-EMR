"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  Loader2,
  Eye,
} from "lucide-react";

const CLAIM_STATUSES = [
  "ALL",
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "SETTLED",
  "APPEALED",
] as const;

export default function InsuranceClaimsPage() {
  const [claims, setClaims] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") {
      params.set("status", statusFilter);
    }
    fetch(`/api/insurance/claims?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setClaims(data.data || []);
        setStats(data.stats || {});
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const totalClaims = (stats.totalClaims as number) || 0;
  const pendingCount = (stats.pendingCount as number) || 0;
  const approvedCount = (stats.approvedCount as number) || 0;
  const settledAmount = (stats.settledAmount as number) || 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Insurance Claims"
        description="Manage insurance and TPA claims"
        createHref="/insurance/claims/new"
        createLabel="New Claim"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClaims}</div>
            <p className="text-xs text-muted-foreground">All time claims</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Ready for settlement</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settled Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settledAmount.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </div>
            <p className="text-xs text-muted-foreground">Total settled</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {CLAIM_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : claims.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No claims found
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim) => (
                <TableRow key={claim.id as string}>
                  <TableCell className="font-medium">
                    {claim.claimNumber as string}
                  </TableCell>
                  <TableCell>{claim.patientName as string}</TableCell>
                  <TableCell>{claim.providerName as string}</TableCell>
                  <TableCell>{claim.claimType as string}</TableCell>
                  <TableCell>
                    {((claim.amount as number) || 0).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status as string} />
                  </TableCell>
                  <TableCell>
                    {new Date(claim.createdAt as string).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
