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
import { HeartPulse, ClipboardList, Calendar, TrendingUp, Plus, Eye } from "lucide-react";

export default function PhysiotherapyPage() {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/physiotherapy/plans").then((r) => r.json()),
      fetch("/api/physiotherapy/sessions").then((r) => r.json()),
    ]).then(([planData, sessionData]) => {
      setPlans(planData.data || []);
      setSessions(sessionData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const activePlans = plans.filter((p) => p.status === "ACTIVE");
  const todaySessions = sessions.filter((s) => new Date(s.sessionDate as string).toDateString() === new Date().toDateString());
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");
  const improvedCount = sessions.filter((s) => s.outcome === "IMPROVED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Physiotherapy" description="Rehabilitation and physical therapy management">
        <Button asChild><Link href="/physiotherapy/plans/new"><Plus className="mr-2 h-4 w-4" />New Treatment Plan</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Plans" value={activePlans.length} icon={ClipboardList} />
        <StatsCard title="Today's Sessions" value={todaySessions.length} icon={Calendar} />
        <StatsCard title="Total Sessions" value={completedSessions.length} icon={HeartPulse} />
        <StatsCard title="Improved" value={improvedCount} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Treatment Plans ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="today">Today ({todaySessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <Card>
            <CardHeader><Input placeholder="Search plans..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : activePlans.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active treatment plans</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePlans.filter((p) => {
                      const patientName = `${(p.patient as Record<string, string>)?.firstName || ""} ${(p.patient as Record<string, string>)?.lastName || ""}`;
                      return `${patientName} ${p.planNo} ${p.diagnosis}`.toLowerCase().includes(search.toLowerCase());
                    }).map((plan) => (
                      <TableRow key={plan.id as string}>
                        <TableCell className="font-medium">{plan.planNo as string}</TableCell>
                        <TableCell>{(plan.patient as Record<string, string>)?.firstName} {(plan.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{plan.diagnosis as string}</TableCell>
                        <TableCell>{(plan.frequency as string) || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${plan.totalSessions ? ((plan.completedSessions as number) / (plan.totalSessions as number)) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs">{plan.completedSessions as number}/{(plan.totalSessions as number | undefined) ?? "?"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(plan.startDate as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={plan.status as string} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild><Link href={`/physiotherapy/sessions?planId=${plan.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No therapy sessions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Pain Level</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id as string}>
                        <TableCell className="font-medium">#{session.sessionNo as number}</TableCell>
                        <TableCell>
                          {(session.therapyPlan as Record<string, Record<string, string>>)?.patient?.firstName}{" "}
                          {(session.therapyPlan as Record<string, Record<string, string>>)?.patient?.lastName}
                        </TableCell>
                        <TableCell>{new Date(session.sessionDate as string).toLocaleDateString()}</TableCell>
                        <TableCell>{session.duration ? `${session.duration} min` : "-"}</TableCell>
                        <TableCell>
                          {session.painLevel !== null && session.painLevel !== undefined ? (
                            <span className={`font-medium ${(session.painLevel as number) >= 7 ? "text-red-600" : (session.painLevel as number) >= 4 ? "text-yellow-600" : "text-green-600"}`}>
                              {session.painLevel as number}/10
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {session.outcome ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${session.outcome === "IMPROVED" ? "bg-green-100 text-green-800" : session.outcome === "DECLINED" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                              {session.outcome as string}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell><StatusBadge status={session.status as string} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardContent className="pt-6">
              {todaySessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sessions scheduled for today</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySessions.map((session) => (
                      <TableRow key={session.id as string}>
                        <TableCell className="font-medium">#{session.sessionNo as number}</TableCell>
                        <TableCell>
                          {(session.therapyPlan as Record<string, Record<string, string>>)?.patient?.firstName}{" "}
                          {(session.therapyPlan as Record<string, Record<string, string>>)?.patient?.lastName}
                        </TableCell>
                        <TableCell>{(session.therapyPlan as Record<string, string>)?.planNo}</TableCell>
                        <TableCell><StatusBadge status={session.status as string} /></TableCell>
                        <TableCell>
                          {session.status === "SCHEDULED" && (
                            <Button size="sm" onClick={async () => {
                              await fetch("/api/physiotherapy/sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, status: "COMPLETED" }) });
                              setSessions(sessions.map((s) => s.id === session.id ? { ...s, status: "COMPLETED" } : s));
                            }}>Complete</Button>
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
      </Tabs>
    </div>
  );
}
