import type { NextConfig } from "next";
import { buildNextSecurityHeaders } from "@retailer-search/config/security-headers";

const securityHeaders = buildNextSecurityHeaders();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
