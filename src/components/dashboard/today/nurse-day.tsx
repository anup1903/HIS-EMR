import { prisma } from "@/lib/prisma";
import { MyDayHeader } from "./my-day-header";
import { WardLiveBoard } from "./ward-live";

interface Props {
  name: string;
}

/**
 * Server component that builds the initial ward snapshot in a single
 * round-trip, then hands it off to <WardLiveBoard/> which subscribes
 * to `/api/ward/stream` for live updates via SSE.
 */
export async function NurseDay({ name }: Props) {
  const [wards, totalBeds, occupiedBeds, availableBeds, maintenanceBeds] =
    await Promise.all([
      prisma.ward.findMany({
        where: { isActive: true },
        include: {
          department: { select: { name: true } },
          beds: {
            orderBy: { bedNumber: "asc" },
            include: {
              admissions: {
                where: { status: "ADMITTED" },
                take: 1,
                orderBy: { admissionDate: "desc" },
                include: {
                  patient: {
                    select: {
                      id: true,
                      mrn: true,
                      firstName: true,
                      lastName: true,
                      dateOfBirth: true,
                      gender: true,
                      allergies: true,
                    },
                  },
                  doctor: { select: { user: { select: { name: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.bed.count(),
      prisma.bed.count({ where: { status: "OCCUPIED" } }),
      prisma.bed.count({ where: { status: "AVAILABLE" } }),
      prisma.bed.count({ where: { status: "MAINTENANCE" } }),
    ]);

  const occupancyPct =
    totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const snapshot = {
    ts: new Date().toISOString(),
    stats: {
      totalBeds,
      occupiedBeds,
      availableBeds,
      maintenanceBeds,
      occupancyPct,
    },
    wards: wards.map((w) => ({
      id: w.id,
      name: w.name,
      floor: w.floor,
      department: w.department.name,
      beds: w.beds.map((b) => {
        const ad = b.admissions[0];
        return {
          id: b.id,
          bedNumber: b.bedNumber,
          status: b.status as "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED",
          admission: ad
            ? {
                id: ad.id,
                admissionDate: ad.admissionDate.toISOString(),
                admissionReason: ad.admissionReason,
                doctorName: ad.doctor.user.name,
                patient: {
                  id: ad.patient.id,
                  mrn: ad.patient.mrn,
                  firstName: ad.patient.firstName,
                  lastName: ad.patient.lastName,
                  dateOfBirth: ad.patient.dateOfBirth.toISOString(),
                  gender: ad.patient.gender,
                  allergies: ad.patient.allergies,
                },
              }
            : null,
        };
      }),
    })),
  };

  return (
    <div className="space-y-6">
      <MyDayHeader
        name={name}
        role="NURSE"
        subtitle="Ward board — live updates via SSE"
      />
      <WardLiveBoard initial={snapshot} />
    </div>
  );
}
