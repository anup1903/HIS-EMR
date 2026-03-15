import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@hospital.com" },
    update: {},
    create: { email: "admin@hospital.com", password: hashedPassword, name: "System Admin", role: "ADMIN", phone: "+1234567890" },
  });

  const departments = [
    { name: "General Medicine", code: "GM", description: "General Medicine Department" },
    { name: "Cardiology", code: "CARD", description: "Heart and Cardiovascular" },
    { name: "Orthopedics", code: "ORTH", description: "Bone and Joint Care" },
    { name: "Pediatrics", code: "PED", description: "Children Healthcare" },
    { name: "Gynecology", code: "GYN", description: "Women Healthcare" },
    { name: "Neurology", code: "NEUR", description: "Brain and Nervous System" },
    { name: "Dermatology", code: "DERM", description: "Skin Care" },
    { name: "ENT", code: "ENT", description: "Ear, Nose and Throat" },
    { name: "Ophthalmology", code: "OPH", description: "Eye Care" },
    { name: "Radiology", code: "RAD", description: "Medical Imaging" },
    { name: "Pathology", code: "PATH", description: "Laboratory Services" },
    { name: "Emergency", code: "ER", description: "Emergency Department" },
  ];
  for (const dept of departments) {
    await prisma.department.upsert({ where: { code: dept.code }, update: {}, create: dept });
  }

  await prisma.hospital.upsert({
    where: { id: "default-hospital" },
    update: {},
    create: { id: "default-hospital", name: "City General Hospital", address: "123 Medical Center Drive", city: "New York", state: "NY", zipCode: "10001", phone: "+1 (555) 123-4567", email: "info@citygeneralhospital.com" },
  });

  const doctorPassword = await bcrypt.hash("doctor123", 12);
  const doctorUser = await prisma.user.upsert({
    where: { email: "doctor@hospital.com" },
    update: {},
    create: { email: "doctor@hospital.com", password: doctorPassword, name: "Dr. John Smith", role: "DOCTOR", phone: "+1234567891" },
  });
  const gmDept = await prisma.department.findUnique({ where: { code: "GM" } });
  if (gmDept) {
    await prisma.doctor.upsert({
      where: { userId: doctorUser.id },
      update: {},
      create: { userId: doctorUser.id, specialization: "General Medicine", qualification: "MD, MBBS", licenseNumber: "DOC-2024-001", departmentId: gmDept.id, consultationFee: 150.00 },
    });
  }

  const receptionistPassword = await bcrypt.hash("reception123", 12);
  await prisma.user.upsert({ where: { email: "reception@hospital.com" }, update: {}, create: { email: "reception@hospital.com", password: receptionistPassword, name: "Jane Wilson", role: "RECEPTIONIST" } });

  const pharmacistPassword = await bcrypt.hash("pharma123", 12);
  await prisma.user.upsert({ where: { email: "pharmacist@hospital.com" }, update: {}, create: { email: "pharmacist@hospital.com", password: pharmacistPassword, name: "Mike Johnson", role: "PHARMACIST" } });

  const labPassword = await bcrypt.hash("lab123", 12);
  await prisma.user.upsert({ where: { email: "lab@hospital.com" }, update: {}, create: { email: "lab@hospital.com", password: labPassword, name: "Sarah Davis", role: "LAB_TECHNICIAN" } });

  const labTests = [
    { name: "Complete Blood Count", code: "CBC", category: "HEMATOLOGY", sampleType: "BLOOD", normalRange: "4.5-11.0 x10^9/L", unit: "x10^9/L", price: 25.00, turnaroundTime: "2 hours" },
    { name: "Blood Glucose Fasting", code: "BGF", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "70-100 mg/dL", unit: "mg/dL", price: 15.00, turnaroundTime: "1 hour" },
    { name: "Lipid Profile", code: "LIPID", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "TC < 200 mg/dL", unit: "mg/dL", price: 35.00, turnaroundTime: "4 hours" },
    { name: "Liver Function Test", code: "LFT", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "Varies", unit: "Various", price: 40.00, turnaroundTime: "4 hours" },
    { name: "Kidney Function Test", code: "KFT", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "Varies", unit: "Various", price: 35.00, turnaroundTime: "4 hours" },
    { name: "Urinalysis", code: "UA", category: "MICROBIOLOGY", sampleType: "URINE", normalRange: "Normal", unit: "N/A", price: 20.00, turnaroundTime: "2 hours" },
    { name: "Thyroid Profile", code: "THY", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "TSH 0.4-4.0 mIU/L", unit: "mIU/L", price: 45.00, turnaroundTime: "6 hours" },
    { name: "HbA1c", code: "HBA1C", category: "BIOCHEMISTRY", sampleType: "BLOOD", normalRange: "< 5.7%", unit: "%", price: 30.00, turnaroundTime: "4 hours" },
  ];
  for (const test of labTests) {
    await prisma.labTest.upsert({ where: { code: test.code }, update: {}, create: test });
  }

  const modalities = [
    { name: "X-Ray", code: "XRAY", description: "Plain radiography", roomNumber: "R-101" },
    { name: "CT Scan", code: "CT", description: "Computed Tomography", roomNumber: "R-102" },
    { name: "MRI", code: "MRI", description: "Magnetic Resonance Imaging", roomNumber: "R-103" },
    { name: "Ultrasound", code: "USG", description: "Ultrasonography", roomNumber: "R-104" },
  ];
  for (const mod of modalities) {
    await prisma.modality.upsert({ where: { code: mod.code }, update: {}, create: mod });
  }

  const drugs = [
    { name: "Paracetamol 500mg", genericName: "Paracetamol", category: "TABLET", dosageForm: "Tablet", strength: "500mg", unitPrice: 0.50, sellingPrice: 1.00, stockQuantity: 1000, reorderLevel: 100 },
    { name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "CAPSULE", dosageForm: "Capsule", strength: "500mg", unitPrice: 1.00, sellingPrice: 2.00, stockQuantity: 500, reorderLevel: 50 },
    { name: "Omeprazole 20mg", genericName: "Omeprazole", category: "CAPSULE", dosageForm: "Capsule", strength: "20mg", unitPrice: 0.80, sellingPrice: 1.50, stockQuantity: 800, reorderLevel: 80 },
  ];
  for (const drug of drugs) {
    const existing = await prisma.drug.findFirst({ where: { name: drug.name } });
    if (!existing) await prisma.drug.create({ data: drug });
  }

  console.log("Seeding completed!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
