import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/helpers/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ward/stream
 *
 * Server-Sent Events endpoint that pushes the current ward/bed snapshot
 * every few seconds so the Nurse Ward Board can render live updates
 * without manual polling from the UI.
 *
 * We favor a simple polling-based SSE rather than Postgres LISTEN/NOTIFY
 * for portability. The payload is small (< 10 KB for a typical hospital),
 * and the interval is configurable via `?interval=5000` (ms).
 *
 * Event format:
 *   event: snapshot
 *   data: { "wards": [...], "stats": {...}, "ts": "2026-04-11T12:34:56.000Z" }
 */
export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const intervalMs = Math.max(
    2000,
    Math.min(60000, Number(new URL(req.url).searchParams.get("interval")) || 5000),
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* controller may already be closed */
        }
      };

      // Close cleanly if the client disconnects
      req.signal.addEventListener("abort", close);

      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          close();
        }
      };

      const snapshot = async () => {
        try {
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
                          doctor: {
                            include: { user: { select: { name: true } } },
                          },
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

          send("snapshot", {
            ts: new Date().toISOString(),
            stats: {
              totalBeds,
              occupiedBeds,
              availableBeds,
              maintenanceBeds,
              occupancyPct:
                totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
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
                  status: b.status,
                  admission: ad
                    ? {
                        id: ad.id,
                        admissionDate: ad.admissionDate,
                        admissionReason: ad.admissionReason,
                        doctorName: ad.doctor.user.name,
                        patient: {
                          id: ad.patient.id,
                          mrn: ad.patient.mrn,
                          firstName: ad.patient.firstName,
                          lastName: ad.patient.lastName,
                          dateOfBirth: ad.patient.dateOfBirth,
                          gender: ad.patient.gender,
                          allergies: ad.patient.allergies,
                        },
                      }
                    : null,
                };
              }),
            })),
          });
        } catch (err) {
          send("error", { message: (err as Error).message });
        }
      };

      // Open with a hello ping so the client knows the stream is alive
      send("hello", { interval: intervalMs });
      await snapshot();

      const timer = setInterval(() => {
        if (closed) {
          clearInterval(timer);
          return;
        }
        void snapshot();
      }, intervalMs);

      // Keepalive comments every 15s to beat proxy idle timeouts
      const ka = setInterval(() => {
        if (closed) {
          clearInterval(ka);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          close();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        clearInterval(ka);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // for nginx
    },
  });
}
