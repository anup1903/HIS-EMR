"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Clock, CheckCircle, DollarSign, Plus, Eye } from "lucide-react";

export default function InsuranceClaimsListPage() {
  const [claims, setClaims] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/insurance/claims?${params}`)
      .then((r) => r.json())
      .then((data) => setClaims(data.data || []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const pendingCount = claims.filter((c) => c.status === "DRAFT" || c.status === "SUBMITTED").length;
  const approvedCount = claims.filter((c) => c.status === "APPROVED").length;
  const settledCount = claims.filter((c) => c.status === "SETTLED").length;
  const totalAmount = claims.reduce((sum, c) => sum + ((c.claimAmount as number) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Claims" description="Manage insurance and TPA claims">
        <Button asChild><Link href="/insurance/claims/new"><Plus className="mr-2 h-4 w-4" />New Claim</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Claims" value={claims.length} icon={FileText} />
        <StatsCard title="Pending" value={pendingCount} icon={Clock} />
        <StatsCard title="Approved" value={approvedCount} icon={CheckCircle} />
        <StatsCard title="Total Amount" value={`$${totalAmount.toLocaleString()}`} icon={DollarSign} />
      </div>

      <div className="flex gap-4">
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option><option value="PARTIALLY_APPROVED">Partially Approved</option>
          <option value="REJECTED">Rejected</option><option value="SETTLED">Settled</option><option value="APPEALED">Appealed</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : claims.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No claims found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Claim Amount</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id as string}>
                    <TableCell className="font-medium">{claim.claimNo as string}</TableCell>
                    <TableCell>{(claim.patient as Record<string, string>)?.firstName} {(claim.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>{(claim.provider as Record<string, string>)?.name}</TableCell>
                    <TableCell>{(claim.claimType as string)?.replace(/_/g, " ")}</TableCell>
                    <TableCell>${((claim.claimAmount as number) || 0).toLocaleString()}</TableCell>
                    <TableCell>{claim.approvedAmount ? `$${((claim.approvedAmount as number)).toLocaleString()}` : "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{claim.diagnosis as string}</TableCell>
                    <TableCell><StatusBadge status={claim.status as string} /></TableCell>
                    <TableCell>{new Date(claim.createdAt as string).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
