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
import { Video, Calendar, Clock, CheckCircle, Plus, ExternalLink } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader title="Telemedicine" description="Virtual consultations and teleconsult sessions">
        <Button asChild><Link href="/telemedicine/new"><Plus className="mr-2 h-4 w-4" />Schedule Session</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Today's Sessions" value={todaySessions.length} icon={Calendar} />
        <StatsCard title="Scheduled" value={scheduledCount} icon={Clock} />
        <StatsCard title="In Progress" value={inProgressCount} icon={Video} />
        <StatsCard title="Completed" value={completedCount} icon={CheckCircle} />
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({scheduledCount})</TabsTrigger>
          <TabsTrigger value="today">Today ({todaySessions.length})</TabsTrigger>
          <TabsTrigger value="all">All Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : (() => {
                const upcoming = sessions.filter((s) => s.status === "SCHEDULED" && new Date(s.scheduledDate as string) >= new Date());
                return upcoming.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No upcoming sessions</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session #</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcoming.map((session) => (
                        <TableRow key={session.id as string}>
                          <TableCell className="font-medium">{session.sessionNo as string}</TableCell>
                          <TableCell>{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</TableCell>
                          <TableCell>{new Date(session.scheduledDate as string).toLocaleDateString()}</TableCell>
                          <TableCell>{session.scheduledTime as string}</TableCell>
                          <TableCell>{(session.meetingPlatform as string)?.replace(/_/g, " ")}</TableCell>
                          <TableCell><StatusBadge status={session.status as string} /></TableCell>
                          <TableCell>
                            {session.meetingLink && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={session.meetingLink as string} target="_blank" rel="noreferrer"><Video className="mr-1 h-4 w-4" />Join</a>
                              </Button>
                            )}
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
                <p className="text-muted-foreground text-center py-8">No sessions scheduled for today</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {todaySessions.map((session) => (
                    <Card key={session.id as string} className={session.status === "IN_PROGRESS" ? "border-2 border-green-500" : ""}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{session.sessionNo as string}</span>
                          <StatusBadge status={session.status as string} />
                        </div>
                        <p className="text-lg font-semibold">{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</p>
                        <p className="text-sm text-muted-foreground">Time: {session.scheduledTime as string}</p>
                        <p className="text-sm text-muted-foreground">Platform: {(session.meetingPlatform as string)?.replace(/_/g, " ")}</p>
                        {session.chiefComplaint && <p className="text-sm mt-2">{session.chiefComplaint as string}</p>}
                        {session.meetingLink && (
                          <Button size="sm" className="mt-3 w-full" asChild>
                            <a href={session.meetingLink as string} target="_blank" rel="noreferrer"><Video className="mr-2 h-4 w-4" />Join Session</a>
                          </Button>
                        )}
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
            <CardHeader><Input placeholder="Search sessions..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" /></CardHeader>
            <CardContent>
              {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sessions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session #</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((session) => (
                      <TableRow key={session.id as string}>
                        <TableCell className="font-medium">{session.sessionNo as string}</TableCell>
                        <TableCell>{(session.patient as Record<string, string>)?.firstName} {(session.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell>{new Date(session.scheduledDate as string).toLocaleDateString()}</TableCell>
                        <TableCell>{session.scheduledTime as string}</TableCell>
                        <TableCell>{session.duration ? `${session.duration} min` : "-"}</TableCell>
                        <TableCell>{(session.meetingPlatform as string)?.replace(/_/g, " ")}</TableCell>
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
