"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed, ClipboardList, Truck, AlertCircle, Plus } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader title="Dietary Management" description="Patient diet plans and meal ordering">
        <Button asChild><Link href="/dietary/plans/new"><Plus className="mr-2 h-4 w-4" />New Diet Plan</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Plans" value={activePlans.length} icon={ClipboardList} />
        <StatsCard title="Pending Meals" value={pendingMeals.length} icon={UtensilsCrossed} />
        <StatsCard title="Preparing" value={preparingMeals.length} icon={Truck} />
        <StatsCard title="Special Diets" value={specialDiets} icon={AlertCircle} />
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Diet Plans ({activePlans.length})</TabsTrigger>
          <TabsTrigger value="meals">Meal Orders ({pendingMeals.length + preparingMeals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          <Card>
            <CardContent className="pt-6">
              {loading ? <p className="text-muted-foreground">Loading...</p> : activePlans.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active diet plans</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Diet Type</TableHead>
                      <TableHead>Calories</TableHead>
                      <TableHead>Allergies</TableHead>
                      <TableHead>Restrictions</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePlans.map((plan) => (
                      <TableRow key={plan.id as string}>
                        <TableCell className="font-medium">{(plan.patient as Record<string, string>)?.firstName} {(plan.patient as Record<string, string>)?.lastName}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${plan.dietType === "REGULAR" ? "bg-green-100 text-green-800" : plan.dietType === "NPO" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                            {(plan.dietType as string)?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>{plan.calories ? `${plan.calories} kcal` : "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{(plan.allergies as string) || "None"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{(plan.restrictions as string) || "None"}</TableCell>
                        <TableCell>{new Date(plan.startDate as string).toLocaleDateString()}</TableCell>
                        <TableCell><StatusBadge status={plan.isActive ? "ACTIVE" : "INACTIVE"} /></TableCell>
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
              {loading ? <p className="text-muted-foreground">Loading...</p> : meals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No meal orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Meal Type</TableHead>
                      <TableHead>Diet Plan</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Special Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meals.map((meal) => (
                      <TableRow key={meal.id as string}>
                        <TableCell className="font-medium">
                          {(meal.dietPlan as Record<string, Record<string, string>>)?.patient?.firstName} {(meal.dietPlan as Record<string, Record<string, string>>)?.patient?.lastName}
                        </TableCell>
                        <TableCell>{(meal.mealType as string)?.replace(/_/g, " ")}</TableCell>
                        <TableCell>{(meal.dietPlan as Record<string, string>)?.dietType?.replace(/_/g, " ")}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{meal.items as string}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{(meal.specialNotes as string) || "-"}</TableCell>
                        <TableCell><StatusBadge status={meal.status as string} /></TableCell>
                        <TableCell>
                          {meal.status === "PENDING" && (
                            <Button size="sm" onClick={async () => {
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
