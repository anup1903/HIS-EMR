"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ROLES_CONFIG = [
  { role: "ADMIN", label: "Administrator", modules: ["All Modules"], description: "Full system access" },
  { role: "DOCTOR", label: "Doctor", modules: ["Patients", "Appointments", "OPD", "IPD", "Laboratory", "Radiology", "Pharmacy"], description: "Clinical operations and patient care" },
  { role: "NURSE", label: "Nurse", modules: ["Patients", "IPD", "OPD", "Appointments"], description: "Patient care and vitals monitoring" },
  { role: "RECEPTIONIST", label: "Receptionist", modules: ["Patients", "Appointments", "Billing"], description: "Front desk and scheduling" },
  { role: "PHARMACIST", label: "Pharmacist", modules: ["Pharmacy", "Inventory"], description: "Drug dispensing and inventory" },
  { role: "LAB_TECHNICIAN", label: "Lab Technician", modules: ["Laboratory"], description: "Lab testing and results" },
  { role: "RADIOLOGIST", label: "Radiologist", modules: ["Radiology"], description: "Imaging and reporting" },
  { role: "ACCOUNTANT", label: "Accountant", modules: ["Billing", "Reports", "Inventory"], description: "Financial management" },
];

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Roles & Permissions" description="Role-based access control configuration" />

      <Card>
        <CardHeader><CardTitle>System Roles</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accessible Modules</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES_CONFIG.map((role) => (
                <TableRow key={role.role}>
                  <TableCell className="font-medium">{role.label}</TableCell>
                  <TableCell className="text-muted-foreground">{role.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.modules.map((mod) => (
                        <Badge key={mod} variant="secondary" className="text-xs">{mod}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
