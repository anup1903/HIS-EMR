"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Shield,
  FileText,
  Clock,
  CheckCircle,
  IndianRupee,
  Loader2,
  Eye,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CLAIM_STATUSES = [
  "ALL",
  "PENDING",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "SETTLED",
  "APPEALED",
] as const;

const claimStatusColor: Record<string, string> = {
  APPROVED: "bg-success/10 text-success",
  UNDER_REVIEW: "bg-warning/10 text-warning",
  SUBMITTED: "bg-info/10 text-info",
  REJECTED: "bg-destructive/10 text-destructive",
  SETTLED: "bg-success/10 text-success",
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-warning/10 text-warning",
  APPEALED: "bg-info/10 text-info",
};

export default function InsuranceClaimsPage() {
  const [claims, setClaims] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

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

  const filteredClaims = search
    ? claims.filter(
        (c) =>
          ((c.claimNumber as string) || "").toLowerCase().includes(search.toLowerCase()) ||
          ((c.patientName as string) || "").toLowerCase().includes(search.toLowerCase()) ||
          ((c.providerName as string) || "").toLowerCase().includes(search.toLowerCase())
      )
    : claims;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Insurance & TPA</h1>
            <p className="text-sm text-muted-foreground">
              Claims management, providers, and policies.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/insurance/claims/new">
            <Plus className="mr-2 h-4 w-4" />
            New Claim
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Claims"
          value={totalClaims}
          description="All time claims"
          icon={FileText}
          accent="primary"
        />
        <StatsCard
          title="Pending"
          value={pendingCount}
          description="Awaiting review"
          icon={Clock}
          accent="warning"
        />
        <StatsCard
          title="Approved"
          value={approvedCount}
          description="Ready for settlement"
          icon={CheckCircle}
          accent="success"
        />
        <StatsCard
          title="Settled Amount"
          value={`₹${Number(settledAmount ?? 0).toFixed(2)}`}
          description="Total settled"
          icon={IndianRupee}
          accent="info"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredClaims.length === 0 ? (
            <MedicalEmptyState
              illustration="inbox"
              title="No claims found"
              description="No insurance claims match your current filters."
              className="my-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">Claim #</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Provider</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Amount</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClaims.map((claim) => (
                  <TableRow key={claim.id as string} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="font-mono text-xs font-medium">
                      {claim.claimNumber as string}
                    </TableCell>
                    <TableCell className="text-sm">{claim.patientName as string}</TableCell>
                    <TableCell className="text-sm">{claim.providerName as string}</TableCell>
                    <TableCell className="text-sm">{(claim.claimType as string)?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="tabular-nums text-sm">
                      ₹{Number(claim.amount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] border-0", claimStatusColor[(claim.status as string)] || "bg-muted text-muted-foreground")}>
                        {(claim.status as string)?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(claim.createdAt as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
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
