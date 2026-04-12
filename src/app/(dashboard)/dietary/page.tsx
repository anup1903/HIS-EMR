"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed, ClipboardList, Truck, AlertCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DietaryManagementPage() {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [meals, setMeals] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dietary/plans").then((r) => r.json()),
      fetch("/api/dietary/meals").then((r) => r.json()),
    ]).then(([planData, mealData]) => {
      setPlans(planData.data || []);
      setMeals(mealData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const activePlans = plans.filter((p) => p.isActive);
  const pendingMeals = meals.filter((m) => m.status === "PENDING");
  const preparingMeals = meals.filter((m) => m.status === "PREPARING");
  const specialDiets = plans.filter((p) => p.isActive && p.dietType !== "REGULAR").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Dietary Management</h1>
            <p className="text-sm text-muted-foreground">Meal planning and dietary monitoring.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/dietary/plans/new"><Plus className="mr-2 h-4 w-4" />New Diet Plan</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Plans" value={activePlans.length} icon={ClipboardList} accent="primary" />
        <StatsCard title="Pending Meals" value={pendingMeals.length} icon={UtensilsCrossed} accent="warning" />
        <StatsCard title="Preparing" value={preparingMeals.length} icon={Truck} accent="info" />
        <StatsCard title="Special Diets" value={specialDiets} icon={AlertCircle} accent="destructive" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Diet Plans ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="meals">Meal Orders ({pendingMeals.length + preparingMeals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activePlans.length === 0 ? (
                <MedicalEmptyState
                  illustration="stethoscope"
                  title="No active diet plans"
                  description="Create a new diet plan to start managing patient nutrition."
                  action={{ label: "New Diet Plan", href: "/dietary/plans/new" }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Diet Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Calories</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Allergies</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Restrictions</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Start Date</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePlans.map((plan) => (
                      <TableRow key={plan.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">
                          {(plan.patient as Record<string, string>)?.firstName} {(plan.patient as Record<string, string>)?.lastName}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            plan.dietType === "REGULAR" && "bg-success/10 text-success",
                            plan.dietType === "NPO" && "bg-destructive/10 text-destructive",
                            plan.dietType !== "REGULAR" && plan.dietType !== "NPO" && "bg-warning/10 text-warning",
                          )}>
                            {(plan.dietType as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{plan.calories ? `${plan.calories} kcal` : "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">{(plan.allergies as string) || "None"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">{(plan.restrictions as string) || "None"}</TableCell>
                        <TableCell className="tabular-nums">{new Date(plan.startDate as string).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            plan.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                          )}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meals">
          <Card>
            <CardHeader><CardTitle>Today&apos;s Meal Orders</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : meals.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No meal orders"
                  description="Meal orders will appear here once diet plans are active."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Meal Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Diet Plan</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Items</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Special Notes</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meals.map((meal) => (
                      <TableRow key={meal.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">
                          {(meal.dietPlan as Record<string, Record<string, string>>)?.patient?.firstName} {(meal.dietPlan as Record<string, Record<string, string>>)?.patient?.lastName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(meal.mealType as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {(meal.dietPlan as Record<string, string>)?.dietType?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{meal.items as string}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">{(meal.specialNotes as string) || "-"}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            meal.status === "PENDING" && "bg-warning/10 text-warning",
                            meal.status === "PREPARING" && "bg-info/10 text-info",
                            meal.status === "DELIVERED" && "bg-success/10 text-success",
                          )}>
                            {(meal.status as string)?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {meal.status === "PENDING" && (
                            <Button size="sm" variant="outline" onClick={async () => {
                              await fetch("/api/dietary/meals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: meal.id, status: "PREPARING" }) });
                              setMeals(meals.map((m) => m.id === meal.id ? { ...m, status: "PREPARING" } : m));
                            }}>Start Prep</Button>
                          )}
                          {meal.status === "PREPARING" && (
                            <Button size="sm" onClick={async () => {
                              await fetch("/api/dietary/meals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: meal.id, status: "DELIVERED" }) });
                              setMeals(meals.map((m) => m.id === meal.id ? { ...m, status: "DELIVERED" } : m));
                            }}>Mark Delivered</Button>
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
