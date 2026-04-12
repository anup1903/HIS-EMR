"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, Users, Clock, CheckCircle, SkipForward, Volume2, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_STATUS_MAP: Record<string, string> = {
  WAITING: "bg-warning/10 text-warning",
  SERVING: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
  SKIPPED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const SERVICE_TYPES = ["OPD", "PHARMACY", "LAB", "RADIOLOGY", "BILLING"];

export default function QueueManagementPage() {
  const [tokens, setTokens] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState("OPD");

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokens = () => {
    fetch("/api/queue/tokens")
      .then((r) => r.json())
      .then((json) => {
        // API returns { data: { tokens: [...], stats: {...} } } or just { data: [...] }
        const payload = json?.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.tokens)
            ? payload.tokens
            : [];
        setTokens(list);
      })
      .finally(() => setLoading(false));
  };

  const todayTokens = tokens.filter((t) => new Date(t.date as string).toDateString() === new Date().toDateString());
  const waiting = todayTokens.filter((t) => t.status === "WAITING");
  const serving = todayTokens.filter((t) => t.status === "SERVING");
  const completed = todayTokens.filter((t) => t.status === "COMPLETED");
  const filteredTokens = todayTokens.filter((t) => t.serviceType === serviceFilter);

  const handleCallNext = async () => {
    const nextToken = waiting.filter((t) => t.serviceType === serviceFilter).sort((a, b) => {
      if (a.priority === "EMERGENCY" && b.priority !== "EMERGENCY") return -1;
      if (b.priority === "EMERGENCY" && a.priority !== "EMERGENCY") return 1;
      if (a.priority === "PRIORITY" && b.priority === "NORMAL") return -1;
      if (b.priority === "PRIORITY" && a.priority === "NORMAL") return 1;
      return (a.tokenNo as number) - (b.tokenNo as number);
    })[0];
    if (!nextToken) return;
    await fetch("/api/queue/tokens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: nextToken.id, status: "SERVING" }) });
    fetchTokens();
  };

  const handleComplete = async (tokenId: string) => {
    await fetch("/api/queue/tokens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tokenId, status: "COMPLETED" }) });
    fetchTokens();
  };

  const handleSkip = async (tokenId: string) => {
    await fetch("/api/queue/tokens", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tokenId, status: "SKIPPED" }) });
    fetchTokens();
  };

  const handleNewToken = async () => {
    await fetch("/api/queue/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceType: serviceFilter, priority: "NORMAL" }) });
    fetchTokens();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ListOrdered className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Queue Management</h1>
            <p className="text-sm text-muted-foreground">Token-based queue display and management.</p>
          </div>
        </div>
        <Button onClick={handleNewToken}>
          <Ticket className="mr-2 h-4 w-4" />Generate Token
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Waiting" value={waiting.length} icon={Users} accent="warning" />
        <StatsCard title="Now Serving" value={serving.length} icon={Volume2} accent="info" />
        <StatsCard title="Completed" value={completed.length} icon={CheckCircle} accent="success" />
        <StatsCard title="Avg Wait (min)" value={waiting.length > 0 ? Math.round(waiting.reduce((sum, t) => sum + ((t.estimatedWait as number) || 10), 0) / waiting.length) : 0} icon={Clock} accent="primary" />
      </div>

      {/* Now Serving Display */}
      {serving.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {serving.map((token) => (
            <Card key={token.id as string} className="stat-card border-2 border-primary/30">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground font-medium">{token.serviceType as string}</p>
                <p className="text-5xl font-bold text-primary tabular-nums my-4">{token.tokenNo as number}</p>
                <p className="text-sm">
                  {(token.patientName as string | undefined) ||
                    `${(token.patient as Record<string, string>)?.firstName || ""} ${(token.patient as Record<string, string>)?.lastName || ""}`.trim() ||
                    "Walk-in"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {token.counterNo ? `Counter ${token.counterNo}` : ""}
                </p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button size="sm" onClick={() => handleComplete(token.id as string)}>Complete</Button>
                  <Button size="sm" variant="outline" onClick={() => handleSkip(token.id as string)}>Skip</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Service Type Tabs */}
      <Tabs defaultValue="OPD" onValueChange={setServiceFilter}>
        <TabsList>
          {SERVICE_TYPES.map((st) => (
            <TabsTrigger key={st} value={st}>
              {st} ({todayTokens.filter((t) => t.serviceType === st && t.status === "WAITING").length})
            </TabsTrigger>
          ))}
        </TabsList>

        {SERVICE_TYPES.map((st) => (
          <TabsContent key={st} value={st}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{st} Queue</CardTitle>
                <Button size="sm" onClick={handleCallNext}>
                  <Volume2 className="mr-2 h-4 w-4" />Call Next
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : filteredTokens.length === 0 ? (
                  <MedicalEmptyState
                    illustration="calendar"
                    title={`No tokens in ${st} queue`}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="text-[11px] uppercase tracking-wider">Token #</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Priority</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Wait Time</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens.sort((a, b) => (a.tokenNo as number) - (b.tokenNo as number)).map((token) => (
                        <TableRow key={token.id as string} className="hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-bold text-lg tabular-nums">{token.tokenNo as number}</TableCell>
                          <TableCell>
                            {(token.patientName as string | undefined) ||
                              `${(token.patient as Record<string, string>)?.firstName || ""} ${(token.patient as Record<string, string>)?.lastName || ""}`.trim() ||
                              "Walk-in"}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[10px] border-0",
                              token.priority === "EMERGENCY" ? "bg-destructive/10 text-destructive" :
                              token.priority === "PRIORITY" ? "bg-warning/10 text-warning" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {token.priority as string}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[10px] border-0",
                              TOKEN_STATUS_MAP[(token.status as string)] || "bg-muted text-muted-foreground"
                            )}>
                              {(token.status as string)?.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {token.estimatedWait ? `${token.estimatedWait} min` : "-"}
                          </TableCell>
                          <TableCell className="space-x-1">
                            {token.status === "WAITING" && (
                              <Button size="sm" variant="ghost" onClick={() => handleSkip(token.id as string)}>
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            )}
                            {token.status === "SERVING" && (
                              <Button size="sm" onClick={() => handleComplete(token.id as string)}>Done</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
