import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { buildNextSecurityHeaders } from "@retailer-search/config/security-headers";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appRoot, "../..");
const securityHeaders = buildNextSecurityHeaders();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
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
