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
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Eye,
  FileText,
} from "lucide-react";

export default function InsurancePoliciesPage() {
  const [policies, setPolicies] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/insurance/policies")
      .then((r) => r.json())
      .then((data) => {
        setPolicies(data.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activePolicies = policies.filter(
    (p) => (p.status as string) === "ACTIVE"
  );
  const expiredPolicies = policies.filter(
    (p) => (p.status as string) === "EXPIRED"
  );

  const formatCurrency = (value: unknown) =>
    ((value as number) || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Insurance Policies"
        description="View patient insurance policies and coverage details"
        createHref="/insurance/policies/new"
        createLabel="Add Policy"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Policies
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{policies.length}</div>
            <p className="text-xs text-muted-foreground">
              All registered policies
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePolicies.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently valid policies
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredPolicies.length}</div>
            <p className="text-xs text-muted-foreground">
              Need renewal
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Coverage Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : policies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-8 text-muted-foreground"
                >
                  No policies found
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => {
                const coverageAmount = (policy.coverageAmount as number) || 0;
                const usedAmount = (policy.usedAmount as number) || 0;
                const balance = coverageAmount - usedAmount;

                return (
                  <TableRow key={policy.id as string}>
                    <TableCell className="font-medium">
                      {policy.policyNumber as string}
                    </TableCell>
                    <TableCell>{policy.patientName as string}</TableCell>
                    <TableCell>{policy.providerName as string}</TableCell>
                    <TableCell>{policy.coverageType as string}</TableCell>
                    <TableCell>{formatCurrency(coverageAmount)}</TableCell>
                    <TableCell>{formatCurrency(usedAmount)}</TableCell>
                    <TableCell
                      className={
                        balance < coverageAmount * 0.1
                          ? "text-red-600 font-medium"
                          : ""
                      }
                    >
                      {formatCurrency(balance)}
                    </TableCell>
                    <TableCell>
                      {policy.validUntil
                        ? new Date(
                            policy.validUntil as string
                          ).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={policy.status as string} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
