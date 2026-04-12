"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Calendar, Clock, CheckCircle, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TelemedicinePage() {
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/telemedicine/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const todaySessions = sessions.filter((s) => {
    const sessionDate = new Date(s.scheduledDate as string).toDateString();
    return sessionDate === new Date().toDateString();
  });
  const scheduledCount = sessions.filter((s) => s.status === "SCHEDULED").length;
  const inProgressCount = sessions.filter((s) => s.status === "IN_PROGRESS").length;
  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;

  const filtered = sessions.filter((s) => {
    const patientName = `${(s.patient as Record<string, string>)?.firstName || ""} ${(s.patient as Record<string, string>)?.lastName || ""}`;
    return `${patientName} ${s.sessionNo}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Telemedicine</h1>
            <p className="text-sm text-muted-foreground">Virtual consultations and remote care.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/telemedicine/new"><Plus className="mr-2 h-4 w-4" />Schedule Session</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Today's Sessions" value={todaySessions.length} icon={Calendar} accent="primary" />
        <StatsCard title="Scheduled" value={scheduledCount} icon={Clock} accent="info" />
        <StatsCard title="In Progress" value={inProgressCount} icon={Video} accent="warning" />
        <StatsCard title="Completed" value={completedCount} icon={CheckCircle} accent="success" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({scheduledCount})</TabsTrigger>
          <TabsTrigger value="today">Today ({todaySessions.length})</TabsTrigger>
          <TabsTrigger value="all">All Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (() => {
                const upcoming = sessions.filter((s) => s.status === "SCHEDULED" && new Date(s.scheduledDate as string) >= new Date());
                return upcoming.length === 0 ? (
                  <MedicalEmptyState
                    illustration="calendar"
                    title="No upcoming sessions"
                    description="Schedule a new telemedicine session to get started."
                    action={{ label: "Schedule Session", href: "/telemedicine/new" }}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50">
                        <TableHead className="text-[11px] uppercase tracking-wider">Session #</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Time</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Platform</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcoming.map((session) => (
                        <TableRow key={session.id as string} className="hover:bg-secondary/30 transition-colors">
                          <TableCell className="font-medium font-mono text-sm">{session.sessionNo as string}</TableCell>
                          <TableCell>{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</TableCell>
                          <TableCell className="tabular-nums">{new Date(session.scheduledDate as string).toLocaleDateString()}</TableCell>
                          <TableCell className="tabular-nums">{session.scheduledTime as string}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {(session.meetingPlatform as string)?.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell><StatusBadge status={session.status as string} /></TableCell>
                          <TableCell>
                            {session.meetingLink ? (
                              <Button size="sm" variant="outline" asChild>
                                <a href={session.meetingLink as string} target="_blank" rel="noreferrer"><Video className="mr-1 h-4 w-4" />Join</a>
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardContent className="pt-6">
              {todaySessions.length === 0 ? (
                <MedicalEmptyState
                  illustration="calendar"
                  title="No sessions scheduled for today"
                  description="Today's telemedicine sessions will appear here."
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {todaySessions.map((session) => (
                    <Card
                      key={session.id as string}
                      className={cn(
                        "stat-card hover:shadow-md transition-all",
                        session.status === "IN_PROGRESS" && "border-2 border-success/50",
                      )}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium font-mono text-sm">{session.sessionNo as string}</span>
                          <StatusBadge status={session.status as string} />
                        </div>
                        <p className="text-lg font-semibold">{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-muted-foreground">Time: {session.scheduledTime as string}</p>
                          <p className="text-sm text-muted-foreground">Platform: {(session.meetingPlatform as string)?.replace(/_/g, " ")}</p>
                        </div>
                        {session.chiefComplaint ? <p className="text-sm mt-2 bg-secondary/50 rounded-md px-2 py-1">{session.chiefComplaint as string}</p> : null}
                        {session.meetingLink ? (
                          <Button size="sm" className="mt-3 w-full" asChild>
                            <a href={session.meetingLink as string} target="_blank" rel="noreferrer"><Video className="mr-2 h-4 w-4" />Join Session</a>
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filtered.length === 0 ? (
                <MedicalEmptyState
                  illustration="calendar"
                  title="No sessions found"
                  description="Try a different search or schedule a new session."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Session #</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Time</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Duration</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Platform</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((session) => (
                      <TableRow key={session.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium font-mono text-sm">{session.sessionNo as string}</TableCell>
                        <TableCell>{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell className="tabular-nums">{new Date(session.scheduledDate as string).toLocaleDateString()}</TableCell>
                        <TableCell className="tabular-nums">{session.scheduledTime as string}</TableCell>
                        <TableCell className="tabular-nums">{session.duration ? `${session.duration} min` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(session.meetingPlatform as string)?.replace(/_/g, " ")}
                          </Badge>
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
      </Tabs>
    </div>
  );
}
