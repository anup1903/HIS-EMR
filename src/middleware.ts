import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const PATH_TO_MODULE: Record<string, string> = {
  "/dashboard": "patients",
  "/patients": "patients",
  "/appointments": "appointments",
  "/opd": "opd",
  "/ipd": "ipd",
  "/billing": "billing",
  "/pharmacy": "pharmacy",
  "/laboratory": "laboratory",
  "/radiology": "radiology",
  "/inventory": "inventory",
  "/hr": "hr",
  "/reports": "reports",
  "/settings": "settings",
};

const PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["patients", "appointments", "opd", "ipd", "billing", "pharmacy", "laboratory", "radiology", "inventory", "hr", "reports", "settings"],
  DOCTOR: ["patients", "appointments", "opd", "ipd", "billing", "pharmacy", "laboratory", "radiology", "reports"],
  NURSE: ["patients", "appointments", "opd", "ipd", "pharmacy", "laboratory", "radiology"],
  RECEPTIONIST: ["patients", "appointments", "opd", "billing"],
  PHARMACIST: ["patients", "pharmacy", "inventory"],
  LAB_TECHNICIAN: ["patients", "laboratory"],
  RADIOLOGIST: ["patients", "radiology"],
  ACCOUNTANT: ["billing", "reports", "hr", "inventory"],
};

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const matchedPath = Object.keys(PATH_TO_MODULE).find((p) =>
      pathname.startsWith(p)
    );

    if (matchedPath) {
      const module = PATH_TO_MODULE[matchedPath];
      const role = token.role as string;
      const allowedModules = PERMISSIONS[role] || [];

      if (!allowedModules.includes(module)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/patients/:path*",
    "/appointments/:path*",
    "/opd/:path*",
    "/ipd/:path*",
    "/billing/:path*",
    "/pharmacy/:path*",
    "/laboratory/:path*",
    "/radiology/:path*",
    "/inventory/:path*",
    "/hr/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
