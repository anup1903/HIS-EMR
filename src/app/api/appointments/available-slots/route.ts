import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) return errorResponse("doctorId and date are required");

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  const schedule = await prisma.doctorSchedule.findUnique({
    where: { doctorId_dayOfWeek: { doctorId, dayOfWeek } },
  });

  if (!schedule || !schedule.isActive) return successResponse([]);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: { gte: targetDate, lt: new Date(targetDate.getTime() + 86400000) },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { startTime: true, endTime: true },
  });

  const bookedSlots = new Set(existingAppointments.map((a) => a.startTime));
  const slots: { startTime: string; endTime: string; available: boolean }[] = [];

  const [startH, startM] = schedule.startTime.split(":").map(Number);
  const [endH, endM] = schedule.endTime.split(":").map(Number);
  let current = startH * 60 + startM;
  const end = endH * 60 + endM;

  while (current + schedule.slotDuration <= end) {
    const slotStart = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
    const slotEnd = `${String(Math.floor((current + schedule.slotDuration) / 60)).padStart(2, "0")}:${String((current + schedule.slotDuration) % 60).padStart(2, "0")}`;
    slots.push({ startTime: slotStart, endTime: slotEnd, available: !bookedSlots.has(slotStart) });
    current += schedule.slotDuration;
  }

  return successResponse(slots);
}
