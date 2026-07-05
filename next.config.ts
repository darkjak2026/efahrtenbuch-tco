import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Baked in at build time — doubles as "last updated" in the footer.
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
