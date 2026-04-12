/**
 * Rich demo seed — creates a realistic hospital dataset matching the
 * Lovable reference app's density. Idempotent — safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const GENDERS = ["MALE", "FEMALE"] as const;
const BLOOD_GROUPS = [
  "A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE",
  "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE",
] as const;

const PATIENT_DATA = [
  { first: "Ravi", last: "Kumar", gender: "MALE", dob: "1990-03-14", phone: "+91 98100 22145", allergies: "Penicillin", chronic: "Type 2 Diabetes" },
  { first: "Asha", last: "Patel", gender: "FEMALE", dob: "1985-07-22", phone: "+91 98110 55211", allergies: null, chronic: "Hypertension" },
  { first: "Karan", last: "Mehta", gender: "MALE", dob: "1975-11-02", phone: "+91 98130 77418", allergies: "Sulfa drugs", chronic: "Hyperlipidemia" },
  { first: "Fatima", last: "Sheikh", gender: "FEMALE", dob: "2001-01-18", phone: "+91 98170 66209", allergies: null, chronic: null },
  { first: "James", last: "Wilson", gender: "MALE", dob: "1981-05-10", phone: "+91 98200 11001", allergies: null, chronic: "Asthma" },
  { first: "Maria", last: "Garcia", gender: "FEMALE", dob: "1994-09-25", phone: "+91 98200 22002", allergies: "Aspirin", chronic: null },
  { first: "Robert", last: "Kim", gender: "MALE", dob: "1968-02-14", phone: "+91 98200 33003", allergies: null, chronic: "COPD, Hypertension" },
  { first: "Emily", last: "Davis", gender: "FEMALE", dob: "1999-12-01", phone: "+91 98200 44004", allergies: null, chronic: null },
  { first: "Ahmad", last: "Hassan", gender: "MALE", dob: "1963-06-30", phone: "+91 98200 55005", allergies: "Iodine contrast", chronic: "CKD Stage 3" },
  { first: "Sophie", last: "Turner", gender: "FEMALE", dob: "1985-04-17", phone: "+91 98200 66006", allergies: null, chronic: "Hypothyroidism" },
  { first: "Daniel", last: "Park", gender: "MALE", dob: "1971-08-22", phone: "+91 98200 77007", allergies: null, chronic: "Type 2 Diabetes, CAD" },
  { first: "Priya", last: "Sharma", gender: "FEMALE", dob: "1992-11-05", phone: "+91 98200 88008", allergies: "Cephalosporins", chronic: null },
  { first: "Anand", last: "Verma", gender: "MALE", dob: "1988-01-20", phone: "+91 98200 99009", allergies: null, chronic: null },
  { first: "Sunita", last: "Reddy", gender: "FEMALE", dob: "1977-03-08", phone: "+91 98201 10010", allergies: null, chronic: "Rheumatoid Arthritis" },
  { first: "Vikram", last: "Singh", gender: "MALE", dob: "1960-07-15", phone: "+91 98201 20011", allergies: "NSAIDs", chronic: "CHF, Atrial Fibrillation" },
  { first: "Neha", last: "Gupta", gender: "FEMALE", dob: "2003-10-30", phone: "+91 98201 30012", allergies: null, chronic: null },
  { first: "Rajesh", last: "Nair", gender: "MALE", dob: "1955-12-25", phone: "+91 98201 40013", allergies: "Morphine", chronic: "Parkinson's Disease" },
  { first: "Lakshmi", last: "Iyer", gender: "FEMALE", dob: "1990-06-18", phone: "+91 98201 50014", allergies: null, chronic: "Epilepsy" },
  { first: "Arjun", last: "Desai", gender: "MALE", dob: "1982-09-12", phone: "+91 98201 60015", allergies: null, chronic: "Gout" },
  { first: "Meera", last: "Joshi", gender: "FEMALE", dob: "1996-02-28", phone: "+91 98201 70016", allergies: "Latex", chronic: null },
];

const WARD_DEFS = [
  { name: "General Ward A", type: "GENERAL", floor: 2, deptCode: "GM", beds: 12 },
  { name: "General Ward B", type: "GENERAL", floor: 2, deptCode: "GM", beds: 10 },
  { name: "ICU", type: "ICU", floor: 3, deptCode: "CARD", beds: 8 },
  { name: "Pediatric Ward", type: "PEDIATRIC", floor: 1, deptCode: "PED", beds: 6 },
  { name: "Maternity Ward", type: "MATERNITY", floor: 1, deptCode: "GYN", beds: 8 },
  { name: "Surgical Ward", type: "SURGICAL", floor: 3, deptCode: "ORTH", beds: 10 },
];

const DRUG_CATALOG = [
  { name: "Paracetamol 500mg", generic: "Paracetamol", cat: "ANALGESIC", form: "Tablet", str: "500mg", cost: 0.50, price: 1.00, stock: 1200 },
  { name: "Amoxicillin 500mg", generic: "Amoxicillin", cat: "ANTIBIOTIC", form: "Capsule", str: "500mg", cost: 1.00, price: 2.50, stock: 800 },
  { name: "Omeprazole 20mg", generic: "Omeprazole", cat: "PPI", form: "Capsule", str: "20mg", cost: 0.80, price: 1.50, stock: 600 },
  { name: "Metformin 500mg", generic: "Metformin", cat: "ANTIDIABETIC", form: "Tablet", str: "500mg", cost: 0.30, price: 0.80, stock: 1500 },
  { name: "Atorvastatin 10mg", generic: "Atorvastatin", cat: "STATIN", form: "Tablet", str: "10mg", cost: 0.60, price: 1.20, stock: 900 },
  { name: "Cetirizine 10mg", generic: "Cetirizine", cat: "ANTIHISTAMINE", form: "Tablet", str: "10mg", cost: 0.20, price: 0.50, stock: 2000 },
  { name: "Amlodipine 5mg", generic: "Amlodipine", cat: "ANTIHYPERTENSIVE", form: "Tablet", str: "5mg", cost: 0.40, price: 0.90, stock: 1100 },
  { name: "Azithromycin 500mg", generic: "Azithromycin", cat: "ANTIBIOTIC", form: "Tablet", str: "500mg", cost: 2.50, price: 5.00, stock: 400 },
  { name: "Pantoprazole 40mg", generic: "Pantoprazole", cat: "PPI", form: "Tablet", str: "40mg", cost: 1.00, price: 2.00, stock: 700 },
  { name: "Ciprofloxacin 500mg", generic: "Ciprofloxacin", cat: "ANTIBIOTIC", form: "Tablet", str: "500mg", cost: 1.50, price: 3.00, stock: 350 },
  { name: "Diclofenac 50mg", generic: "Diclofenac", cat: "NSAID", form: "Tablet", str: "50mg", cost: 0.30, price: 0.70, stock: 15 },
  { name: "Insulin Glargine 100IU/mL", generic: "Insulin Glargine", cat: "INSULIN", form: "Injection", str: "100IU/mL", cost: 250, price: 450, stock: 50 },
  { name: "Salbutamol 100mcg", generic: "Salbutamol", cat: "BRONCHODILATOR", form: "Inhaler", str: "100mcg", cost: 30, price: 65, stock: 120 },
  { name: "Clopidogrel 75mg", generic: "Clopidogrel", cat: "ANTIPLATELET", form: "Tablet", str: "75mg", cost: 1.20, price: 2.50, stock: 500 },
  { name: "Losartan 50mg", generic: "Losartan", cat: "ARB", form: "Tablet", str: "50mg", cost: 0.50, price: 1.00, stock: 0 },
];

async function main() {
  console.log("🏥 Rich seed: creating a full hospital dataset...\n");

  // ── 1. Departments (use existing from base seed) ──
  const depts = await prisma.department.findMany();
  const deptByCode = Object.fromEntries(depts.map((d) => [d.code, d]));

  // ── 2. Patients ──
  let mrnCounter = (await prisma.patient.count()) + 1;
  const patientIds: string[] = [];
  for (const p of PATIENT_DATA) {
    let patient = await prisma.patient.findFirst({
      where: { firstName: p.first, lastName: p.last, phone: p.phone },
    });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          mrn: `MRN${String(100000 + mrnCounter++).slice(-6)}`,
          firstName: p.first,
          lastName: p.last,
          dateOfBirth: new Date(p.dob),
          gender: p.gender as "MALE" | "FEMALE",
          bloodGroup: randomItem([...BLOOD_GROUPS]),
          phone: p.phone,
          address: `${randomInt(1, 200)} Hospital Road`,
          city: randomItem(["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai"]),
          state: randomItem(["MH", "DL", "KA", "TG", "TN"]),
          zipCode: String(randomInt(100000, 999999)),
          allergies: p.allergies,
          chronicConditions: p.chronic,
        },
      });
    }
    patientIds.push(patient.id);
  }
  console.log(`  ✓ ${patientIds.length} patients`);

  // ── 3. Doctor users ──
  const doctorDefs = [
    { email: "doctor@hospital.com", name: "Dr. John Smith", spec: "General Medicine", dept: "GM", license: "DOC-2024-001" },
    { email: "dr.patel@hospital.com", name: "Dr. Anita Patel", spec: "Cardiology", dept: "CARD", license: "DOC-2024-002" },
    { email: "dr.khan@hospital.com", name: "Dr. Imran Khan", spec: "Orthopedics", dept: "ORTH", license: "DOC-2024-003" },
    { email: "dr.reddy@hospital.com", name: "Dr. Sita Reddy", spec: "Pediatrics", dept: "PED", license: "DOC-2024-004" },
    { email: "dr.chen@hospital.com", name: "Dr. Sarah Chen", spec: "Gynecology", dept: "GYN", license: "DOC-2024-005" },
  ];
  const hashedPw = await bcrypt.hash("doctor123", 12);
  const doctorIds: string[] = [];
  for (const dd of doctorDefs) {
    const user = await prisma.user.upsert({
      where: { email: dd.email },
      update: {},
      create: { email: dd.email, password: hashedPw, name: dd.name, role: "DOCTOR" },
    });
    const dept = deptByCode[dd.dept];
    if (!dept) continue;
    const doc = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialization: dd.spec,
        qualification: "MD, MBBS",
        licenseNumber: dd.license,
        departmentId: dept.id,
        consultationFee: randomInt(300, 1500),
      },
    });
    doctorIds.push(doc.id);
  }
  console.log(`  ✓ ${doctorIds.length} doctors`);

  // ── 4. Wards + Beds ──
  let totalBeds = 0;
  const wardIds: string[] = [];
  const allBedIds: string[] = [];
  for (const wd of WARD_DEFS) {
    const dept = deptByCode[wd.deptCode];
    if (!dept) continue;
    const ward = await prisma.ward.upsert({
      where: { name: wd.name },
      update: { totalBeds: wd.beds },
      create: { name: wd.name, departmentId: dept.id, type: wd.type, totalBeds: wd.beds, floor: wd.floor },
    });
    wardIds.push(ward.id);
    const prefix = wd.name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
    for (let i = 1; i <= wd.beds; i++) {
      const bedNumber = `${prefix}-${String(i).padStart(2, "0")}`;
      const rate = wd.type === "ICU" ? 8000 : wd.type === "MATERNITY" ? 3500 : wd.type === "SURGICAL" ? 5000 : 1500;
      let bed = await prisma.bed.findFirst({ where: { wardId: ward.id, bedNumber } });
      if (!bed) {
        bed = await prisma.bed.create({
          data: { wardId: ward.id, bedNumber, dailyRate: rate, status: "AVAILABLE" },
        });
      }
      allBedIds.push(bed.id);
      totalBeds++;
    }
  }
  console.log(`  ✓ ${WARD_DEFS.length} wards, ${totalBeds} beds`);

  // ── 5. Admissions (occupy ~60% of beds) ──
  const availableBeds = await prisma.bed.findMany({ where: { status: "AVAILABLE" }, take: Math.floor(totalBeds * 0.6) });
  let admCount = 0;
  for (const bed of availableBeds) {
    const patientId = randomItem(patientIds);
    const doctorId = randomItem(doctorIds);
    const existing = await prisma.admission.findFirst({ where: { patientId, status: "ADMITTED" } });
    if (existing) continue;
    const admNo = `ADM-${Date.now().toString().slice(-6)}-${admCount}`;
    const reasons = [
      "Chest pain evaluation", "Pneumonia", "Post-surgical observation",
      "Diabetic ketoacidosis", "Acute appendicitis", "Fracture management",
      "Scheduled chemotherapy", "Pre-eclampsia monitoring", "COPD exacerbation",
      "Cellulitis IV antibiotics", "Stroke workup", "GI bleed observation",
    ];
    await prisma.admission.create({
      data: {
        admissionNo: admNo,
        patientId,
        doctorId,
        bedId: bed.id,
        admissionReason: randomItem(reasons),
        diagnosis: randomItem(reasons),
        status: "ADMITTED",
        admissionDate: daysAgo(randomInt(0, 14)),
      },
    });
    await prisma.bed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });
    admCount++;
  }
  // Mark a couple beds as MAINTENANCE
  const maintBeds = await prisma.bed.findMany({ where: { status: "AVAILABLE" }, take: 3 });
  for (const b of maintBeds) {
    await prisma.bed.update({ where: { id: b.id }, data: { status: "MAINTENANCE" } });
  }
  console.log(`  ✓ ${admCount} admissions (${Math.round(admCount / totalBeds * 100)}% occupancy)`);

  // ── 6. Drugs ──
  let drugCount = 0;
  const drugIds: string[] = [];
  for (const d of DRUG_CATALOG) {
    let drug = await prisma.drug.findFirst({ where: { name: d.name } });
    if (!drug) {
      drug = await prisma.drug.create({
        data: {
          name: d.name, genericName: d.generic, category: d.cat,
          dosageForm: d.form, strength: d.str,
          unitPrice: d.cost, sellingPrice: d.price,
          stockQuantity: d.stock, reorderLevel: Math.max(20, Math.floor(d.stock * 0.1)),
        },
      });
      drugCount++;
    }
    drugIds.push(drug.id);
  }
  console.log(`  ✓ ${drugIds.length} drugs (${drugCount} new)`);

  // ── 7. Today's Appointments ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const slots = [
    "08:30", "09:00", "09:15", "09:30", "09:45", "10:00", "10:30", "11:00",
    "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  ];
  const statuses: ("SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED")[] = ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "COMPLETED", "COMPLETED"];
  let aptCount = 0;
  for (let i = 0; i < Math.min(slots.length, patientIds.length); i++) {
    const existing = await prisma.appointment.findFirst({
      where: { patientId: patientIds[i], date: today, startTime: slots[i] },
    });
    if (existing) continue;
    await prisma.appointment.create({
      data: {
        appointmentNo: `APT-RICH-${Date.now().toString().slice(-5)}-${i}`,
        patientId: patientIds[i],
        doctorId: randomItem(doctorIds),
        date: today,
        startTime: slots[i],
        endTime: `${slots[i].split(":")[0]}:${String(Number(slots[i].split(":")[1]) + 15).padStart(2, "0")}`,
        status: randomItem(statuses),
        type: randomItem(["CONSULTATION", "FOLLOW_UP"]),
        reason: randomItem(["Routine checkup", "Follow-up", "Fever", "Chest pain", "Lab review", "Medication adjustment"]),
        tokenNumber: i + 1,
      },
    });
    aptCount++;
  }
  console.log(`  ✓ ${aptCount} appointments today`);

  // ── 8. Consultations + Prescriptions ──
  let consCount = 0, rxCount = 0;
  const diagnoses = [
    "Acute viral URI", "Hypertension follow-up", "Type 2 DM control",
    "Acute gastritis", "Lower back pain", "Urinary tract infection",
    "Migraine", "Bronchitis", "Allergic rhinitis", "Ankle sprain",
  ];
  for (let i = 0; i < 8; i++) {
    const patientId = patientIds[i % patientIds.length];
    const doctorId = randomItem(doctorIds);
    const dx = diagnoses[i % diagnoses.length];
    let consult = await prisma.consultation.findFirst({
      where: { patientId, doctorId, diagnosis: dx },
    });
    if (!consult) {
      consult = await prisma.consultation.create({
        data: {
          consultationNo: `CONS-RICH-${Date.now().toString().slice(-5)}-${i}`,
          patientId, doctorId,
          chiefComplaint: randomItem(["Fever x 3 days", "Cough", "Chest pain", "Headache", "Joint pain", "Abdominal pain"]),
          diagnosis: dx,
          treatmentPlan: "Medications prescribed. Review in 1 week.",
          status: randomItem(["COMPLETED", "IN_PROGRESS"]),
          createdAt: daysAgo(randomInt(0, 30)),
        },
      });
      consCount++;
    }

    // Prescription for this consultation
    const existingRx = await prisma.prescription.findFirst({ where: { consultationId: consult.id } });
    if (!existingRx && drugIds.length >= 2) {
      const rxDrugs = [randomItem(drugIds), randomItem(drugIds)].filter((v, i, a) => a.indexOf(v) === i);
      await prisma.prescription.create({
        data: {
          prescriptionNo: `RX-RICH-${Date.now().toString().slice(-5)}-${i}`,
          patientId, consultationId: consult.id,
          prescribedBy: randomItem(["Dr. John Smith", "Dr. Anita Patel", "Dr. Sarah Chen"]),
          status: randomItem(["PENDING", "COMPLETED"]),
          notes: `Dx: ${dx}`,
          items: {
            create: rxDrugs.map((did) => ({
              drugId: did,
              dosage: randomItem(["1-0-1", "0-0-1", "1-1-1"]),
              frequency: randomItem(["1-0-1 · After food", "0-0-1 · Bedtime", "1-1-1 · After food"]),
              duration: randomItem(["3 days", "5 days", "7 days", "10 days"]),
              route: "ORAL",
              instructions: randomItem(["Take with water", "After meals", "Before bed", ""]),
              quantity: randomInt(5, 30),
            })),
          },
        },
      });
      rxCount++;
    }
  }
  console.log(`  ✓ ${consCount} consultations, ${rxCount} prescriptions`);

  // ── 9. Lab Orders ──
  const labTests = await prisma.labTest.findMany();
  let loCount = 0;
  if (labTests.length > 0) {
    for (let i = 0; i < 6; i++) {
      const patientId = randomItem(patientIds);
      await prisma.labOrder.create({
        data: {
          orderNo: `LAB-RICH-${Date.now().toString().slice(-5)}-${i}`,
          patientId,
          orderedBy: randomItem(["Dr. John Smith", "Dr. Anita Patel"]),
          priority: randomItem(["ROUTINE", "URGENT", "STAT"]),
          status: randomItem(["PENDING", "IN_PROGRESS", "COMPLETED"]),
          clinicalInfo: randomItem(["R/O infection", "Annual screening", "Pre-op workup", "DM monitoring"]),
          createdAt: daysAgo(randomInt(0, 7)),
          items: {
            create: [randomItem(labTests), randomItem(labTests)]
              .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
              .map((t) => ({ labTestId: t.id, status: "PENDING" })),
          },
        },
      });
      loCount++;
    }
  }
  console.log(`  ✓ ${loCount} lab orders`);

  // ── 10. Emergency Visits ──
  let erCount = 0;
  const triageLevels = ["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"] as const;
  for (let i = 0; i < 4; i++) {
    const patientId = randomItem(patientIds);
    await prisma.emergencyVisit.create({
      data: {
        visitNo: `ER-RICH-${Date.now().toString().slice(-5)}-${i}`,
        patient: { connect: { id: patientId } },
        triageLevel: randomItem([...triageLevels]),
        chiefComplaint: randomItem(["Chest pain", "Severe headache", "Fracture", "Burn injury", "Allergic reaction"]),
        arrivalMode: randomItem(["WALK_IN", "AMBULANCE", "REFERRED"]),
        arrivalTime: daysAgo(randomInt(0, 3)),
        disposition: randomItem(["ADMITTED", "DISCHARGED", "UNDER_OBSERVATION"]),
      },
    });
    erCount++;
  }
  console.log(`  ✓ ${erCount} emergency visits`);

  // ── 11. Invoices + Payments ──
  let invCount = 0;
  for (let i = 0; i < 5; i++) {
    const patientId = randomItem(patientIds);
    const subtotal = randomInt(500, 15000);
    const tax = Math.round(subtotal * 0.05);
    const total = subtotal + tax;
    const paid = randomItem([0, total, Math.round(total * 0.5)]);
    const inv = await prisma.invoice.create({
      data: {
        invoiceNo: `INV-RICH-${Date.now().toString().slice(-5)}-${i}`,
        patientId,
        subtotal, taxAmount: tax, discountAmount: 0,
        totalAmount: total, paidAmount: paid, balanceAmount: total - paid,
        status: paid >= total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED",
        createdBy: "System Admin",
        items: {
          create: [
            { description: "Consultation", category: "Consultation", quantity: 1, unitPrice: 500, amount: 500 },
            { description: randomItem(["CBC", "LFT", "X-Ray Chest"]), category: "Labs", quantity: 1, unitPrice: subtotal - 500, amount: subtotal - 500 },
          ],
        },
      },
    });
    if (paid > 0) {
      await prisma.payment.create({
        data: {
          paymentNo: `PAY-RICH-${Date.now().toString().slice(-5)}-${i}`,
          invoiceId: inv.id,
          amount: paid,
          method: randomItem(["CASH", "CARD", "UPI"]),
          receivedBy: "Jane Wilson",
          paidAt: daysAgo(randomInt(0, 5)),
        },
      });
    }
    invCount++;
  }
  console.log(`  ✓ ${invCount} invoices`);

  // ── Summary ──
  const [pC, wC, bC, aC, cC, rC, adC, lC, dC, eC, iC] = await Promise.all([
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.ward.count(),
    prisma.bed.count(),
    prisma.appointment.count(),
    prisma.consultation.count(),
    prisma.prescription.count(),
    prisma.admission.count({ where: { status: "ADMITTED" } }),
    prisma.labOrder.count(),
    prisma.drug.count(),
    prisma.emergencyVisit.count(),
    prisma.invoice.count(),
  ]);
  const occ = await prisma.bed.count({ where: { status: "OCCUPIED" } });

  console.log(`\n✅ Rich seed complete:`);
  console.log(`   ${pC} patients · ${wC} wards · ${bC} beds (${occ} occupied, ${Math.round(occ/bC*100)}%)`);
  console.log(`   ${aC} appointments · ${cC} consultations · ${rC} prescriptions`);
  console.log(`   ${adC} active admissions · ${lC} lab orders · ${dC} drugs`);
  console.log(`   ${eC} ER visits · ${iC} invoices`);
}

main()
  .catch((e) => { console.error("Rich seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
