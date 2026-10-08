import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenständiges Server-Paket (.next/standalone) für den eigenen Server;
  // Vercel ignoriert die Einstellung.
  output: "standalone",
  env: {
    // Baked in at build time — doubles as "last updated" in the footer.
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
