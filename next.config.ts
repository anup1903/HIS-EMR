import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: "standalone"` is required for the Docker image (copies .next/standalone).
  // Vercel ignores this setting and uses its own build output.
  output: "standalone",
  // Poweredby header leaks stack info — remove it.
  poweredByHeader: false,
  // Defer image optimization to Vercel's Image CDN in prod; allow remote hosts.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Server external packages — keep Prisma out of the client bundle.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
