import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, type Module, type Action } from "@/lib/constants/roles";
import { type Role } from "@prisma/client";

export async function getAuthSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth(module: Module, action: Action) {
  const session = await getAuthSession();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }

  const userRole = (session.user as { role: string }).role as Role;

  if (!hasPermission(userRole, module, action)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}
