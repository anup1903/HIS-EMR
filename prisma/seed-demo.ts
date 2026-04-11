/**
 * Supplemental demo seed — populates wards, beds, appointments, consultations,
 * admissions, and one sample prescription so every dashboard has real data
 * to render without touching the base seed.
 *
 * Idempotent — safe to run multiple times. Uses `findFirst` before create
 * to avoid duplicating demo rows.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("📦 Demo seed: adding wards, beds, appointments, consultation, Rx…");

  // ── 1. Wards + beds ──────────────────────────────────────────────
  const gm = await prisma.department.findUnique({ where: { code: "GM" } });
  const cardio = await prisma.department.findUnique({ where: { code: "CARD" } });
  if (!gm || !cardio) throw new Error("Base departments missing — run npm run db:seed first");

  const generalWard = await prisma.ward.upsert({
    where: { name: "General Ward A" },
    update: {},
    create: {
      name: "General Ward A",
      departmentId: gm.id,
      type: "GENERAL",
      totalBeds: 6,
      floor: 2,
    },
  });

  const icu = await prisma.ward.upsert({
    where: { name: "ICU" },
    update: {},
    create: {
      name: "ICU",
      departmentId: cardio.id,
      type: "ICU",
      totalBeds: 4,
      floor: 3,
    },
  });

  const bedDefs = [
    { ward: generalWard, nums: ["A-01", "A-02", "A-03", "A-04", "A-05", "A-06"], rate: 1500 },
    { ward: icu, nums: ["ICU-1", "ICU-2", "ICU-3", "ICU-4"], rate: 8000 },
  ];

  for (const def of bedDefs) {
    for (const bedNumber of def.nums) {
      const existing = await prisma.bed.findFirst({
        where: { wardId: def.ward.id, bedNumber },
      });
      if (!existing) {
        await prisma.bed.create({
          data: {
            wardId: def.ward.id,
            bedNumber,
            dailyRate: def.rate,
            status: "AVAILABLE",
          },
        });
      }
    }
  }

  // ── 2. More patients (augment the 3 already present) ──────────────
  const patientDefs = [
    {
      firstName: "Ravi",
      lastName: "Kumar",
      dateOfBirth: new Date("1990-03-14"),
      gender: "MALE" as const,
      bloodGroup: "B_POSITIVE" as const,
      phone: "+91 98100 22145",
      address: "42 Vihar Road",
      city: "Mumbai",
      state: "MH",
      zipCode: "400001",
      allergies: "Penicillin",
      chronicConditions: "Type 2 Diabetes",
    },
    {
      firstName: "Asha",
      lastName: "Patel",
      dateOfBirth: new Date("1985-07-22"),
      gender: "FEMALE" as const,
      bloodGroup: "O_POSITIVE" as const,
      phone: "+91 98110 55211",
      address: "7 Marine Drive",
      city: "Mumbai",
      state: "MH",
      zipCode: "400020",
      allergies: null,
      chronicConditions: "Hypertension",
    },
    {
      firstName: "Karan",
      lastName: "Mehta",
      dateOfBirth: new Date("1975-11-02"),
      gender: "MALE" as const,
      bloodGroup: "A_POSITIVE" as const,
      phone: "+91 98130 77418",
      address: "Sector 15, Block C",
      city: "Delhi",
      state: "DL",
      zipCode: "110015",
      allergies: "Sulfa drugs",
      chronicConditions: "Hyperlipidemia",
    },
    {
      firstName: "Fatima",
      lastName: "Sheikh",
      dateOfBirth: new Date("2001-01-18"),
      gender: "FEMALE" as const,
      bloodGroup: "AB_NEGATIVE" as const,
      phone: "+91 98170 66209",
      address: "Old Market Road",
      city: "Hyderabad",
      state: "TG",
      zipCode: "500001",
      allergies: null,
      chronicConditions: null,
    },
  ];

  const existingCount = await prisma.patient.count({ where: { deletedAt: null } });
  let mrnSeed = existingCount + 1;
  for (const p of patientDefs) {
    const exists = await prisma.patient.findFirst({
      where: { firstName: p.firstName, lastName: p.lastName, phone: p.phone },
    });
    if (!exists) {
      await prisma.patient.create({
        data: {
          mrn: `MRN${String(100000 + mrnSeed).slice(-6)}`,
          ...p,
        },
      });
      mrnSeed++;
    }
  }

  // ── 3. Admit one patient so the ward board has an occupied bed ────
  const doctor = await prisma.doctor.findFirst();
  const anyBed = await prisma.bed.findFirst({
    where: { wardId: generalWard.id, status: "AVAILABLE" },
  });
  const ravi = await prisma.patient.findFirst({
    where: { firstName: "Ravi", lastName: "Kumar" },
  });
  if (doctor && anyBed && ravi) {
    const alreadyAdmitted = await prisma.admission.findFirst({
      where: { patientId: ravi.id, status: "ADMITTED" },
    });
    if (!alreadyAdmitted) {
      const admissionNo = `ADM-${Date.now().toString().slice(-6)}`;
      await prisma.admission.create({
        data: {
          admissionNo,
          patientId: ravi.id,
          doctorId: doctor.id,
          bedId: anyBed.id,
          admissionReason: "Diabetic ketoacidosis · observation",
          diagnosis: "DKA",
          status: "ADMITTED",
        },
      });
      await prisma.bed.update({
        where: { id: anyBed.id },
        data: { status: "OCCUPIED" },
      });
    }
  }

  // ── 4. Today's appointments for the doctor ────────────────────────
  if (doctor) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const patients = await prisma.patient.findMany({ take: 4, where: { deletedAt: null } });
    const timeSlots = [
      { start: "09:00", end: "09:15", status: "CHECKED_IN" as const },
      { start: "09:30", end: "09:45", status: "IN_PROGRESS" as const },
      { start: "10:00", end: "10:15", status: "SCHEDULED" as const },
      { start: "10:30", end: "10:45", status: "COMPLETED" as const },
    ];
    for (let i = 0; i < Math.min(patients.length, timeSlots.length); i++) {
      const patient = patients[i];
      const slot = timeSlots[i];
      const already = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          doctorId: doctor.id,
          date: today,
          startTime: slot.start,
        },
      });
      if (!already) {
        await prisma.appointment.create({
          data: {
            appointmentNo: `APT-${Date.now().toString().slice(-6)}-${i}`,
            patientId: patient.id,
            doctorId: doctor.id,
            date: today,
            startTime: slot.start,
            endTime: slot.end,
            status: slot.status,
            type: "CONSULTATION",
            reason: "Follow-up visit",
            tokenNumber: i + 1,
          },
        });
      }
    }
  }

  // ── 5. An IN_PROGRESS consultation + a sample prescription ────────
  const consultPatient = await prisma.patient.findFirst({
    where: { firstName: "Asha", lastName: "Patel" },
  });
  if (doctor && consultPatient) {
    let consult = await prisma.consultation.findFirst({
      where: { doctorId: doctor.id, patientId: consultPatient.id },
    });
    if (!consult) {
      consult = await prisma.consultation.create({
        data: {
          consultationNo: `CONS-${Date.now().toString().slice(-6)}`,
          patientId: consultPatient.id,
          doctorId: doctor.id,
          chiefComplaint: "Cough + fever x 3 days",
          historyOfPresentIllness:
            "Dry cough, low-grade fever, no SOB, no chest pain.",
          examination: "Chest clear. Throat mildly congested.",
          diagnosis: "Acute viral upper respiratory infection",
          treatmentPlan: "Symptomatic · rest · hydration · review 5d",
          status: "IN_PROGRESS",
        },
      });
    }

    const para = await prisma.drug.findFirst({
      where: { name: { contains: "Paracetamol" } },
    });
    const omep = await prisma.drug.findFirst({
      where: { name: { contains: "Omeprazole" } },
    });
    const existingRx = await prisma.prescription.findFirst({
      where: { consultationId: consult.id },
    });
    if (!existingRx && para && omep) {
      const yyyymmdd = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const rxNo = `RX-${yyyymmdd}-DEMO`;
      await prisma.prescription.create({
        data: {
          prescriptionNo: rxNo,
          patientId: consultPatient.id,
          consultationId: consult.id,
          prescribedBy: "Dr. John Smith",
          notes:
            "Dx: Acute viral URI\nTake rest, plenty of fluids. Return if fever > 3 more days.",
          items: {
            create: [
              {
                drugId: para.id,
                dosage: "1-0-1",
                frequency: "1-0-1 · After food",
                duration: "5 days",
                route: "ORAL",
                instructions: "For fever and body aches",
                quantity: 10,
              },
              {
                drugId: omep.id,
                dosage: "1-0-0",
                frequency: "1-0-0 · Before breakfast",
                duration: "5 days",
                route: "ORAL",
                instructions: "On empty stomach",
                quantity: 5,
              },
            ],
          },
        },
      });
    }
  }

  // ── 6. Radiology exam types (needed by EMR imaging tab) ───────────
  const xr = await prisma.modality.findFirst({ where: { code: "XRAY" } });
  if (xr) {
    const existingExam = await prisma.radiologyExamType.findFirst({
      where: { code: "CXR" },
    });
    if (!existingExam) {
      await prisma.radiologyExamType.create({
        data: {
          name: "Chest X-ray PA",
          code: "CXR",
          modalityId: xr.id,
          price: 600,
          bodyPart: "Chest",
        },
      });
    }
  }

  const [pCount, wCount, bCount, aCount, rxCount] = await Promise.all([
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.ward.count(),
    prisma.bed.count(),
    prisma.appointment.count(),
    prisma.prescription.count(),
  ]);

  console.log(
    `✅ Demo seed complete: ${pCount} patients · ${wCount} wards · ${bCount} beds · ${aCount} appointments · ${rxCount} prescriptions`,
  );
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
