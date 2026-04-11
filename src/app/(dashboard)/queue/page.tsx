"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, Users, Clock, CheckCircle, SkipForward, Volume2 } from "lucide-react";

const TOKEN_STATUS_COLORS: Record<string, string> = {
  WAITING: "bg-yellow-100 text-yellow-800",
  SERVING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  SKIPPED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
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
      .then((data) => setTokens(data.data || []))
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
    <div className="space-y-6">
      <PageHeader title="Queue Management" description="Token-based queue display and management">
        <Button onClick={handleNewToken}><Ticket className="mr-2 h-4 w-4" />Generate Token</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Waiting" value={waiting.length} icon={Users} />
        <StatsCard title="Now Serving" value={serving.length} icon={Volume2} />
        <StatsCard title="Completed" value={completed.length} icon={CheckCircle} />
        <StatsCard title="Avg Wait (min)" value={waiting.length > 0 ? Math.round(waiting.reduce((sum, t) => sum + ((t.estimatedWait as number) || 10), 0) / waiting.length) : 0} icon={Clock} />
      </div>

      {/* Now Serving Display */}
      {serving.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {serving.map((token) => (
            <Card key={token.id as string} className="border-2 border-blue-500">
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">{token.serviceType as string}</p>
                <p className="text-6xl font-bold text-blue-600 my-4">{token.tokenNo as number}</p>
                <p className="text-sm">{(token.patientName as string | undefined) || `${(token.patient as Record<string, string>)?.firstName || ""} ${(token.patient as Record<string, string>)?.lastName || ""}`.trim() || "Walk-in"}</p>
                <p className="text-xs text-muted-foreground mt-1">{token.counterNo ? `Counter ${token.counterNo}` : ""}</p>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button size="sm" onClick={() => handleComplete(token.id as string)}>Complete</Button>
                  <Button size="sm" variant="outline" onClick={() => handleSkip(token.id as string)}>Skip</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="OPD" onValueChange={setServiceFilter}>
        <TabsList>
          {SERVICE_TYPES.map((st) => (
            <TabsTrigger key={st} value={st}>{st} ({todayTokens.filter((t) => t.serviceType === st && t.status === "WAITING").length})</TabsTrigger>
          ))}
        </TabsList>

        {SERVICE_TYPES.map((st) => (
          <TabsContent key={st} value={st}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{st} Queue</CardTitle>
                <Button size="sm" onClick={handleCallNext}><Volume2 className="mr-2 h-4 w-4" />Call Next</Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground">Loading...</p> : filteredTokens.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tokens in {st} queue</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token #</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Wait Time</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens.sort((a, b) => (a.tokenNo as number) - (b.tokenNo as number)).map((token) => (
                        <TableRow key={token.id as string}>
                          <TableCell className="font-bold text-lg">{token.tokenNo as number}</TableCell>
                          <TableCell>{(token.patientName as string | undefined) || `${(token.patient as Record<string, string>)?.firstName || ""} ${(token.patient as Record<string, string>)?.lastName || ""}`.trim() || "Walk-in"}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${token.priority === "EMERGENCY" ? "bg-red-100 text-red-800" : token.priority === "PRIORITY" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-800"}`}>
                              {token.priority as string}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TOKEN_STATUS_COLORS[(token.status as string)] || "bg-gray-100 text-gray-800"}`}>
                              {(token.status as string)?.replace(/_/g, " ")}
                            </span>
                          </TableCell>
                          <TableCell>{token.estimatedWait ? `${token.estimatedWait} min` : "-"}</TableCell>
                          <TableCell className="space-x-1">
                            {token.status === "WAITING" && <Button size="sm" variant="ghost" onClick={() => handleSkip(token.id as string)}><SkipForward className="h-4 w-4" /></Button>}
                            {token.status === "SERVING" && <Button size="sm" onClick={() => handleComplete(token.id as string)}>Done</Button>}
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
