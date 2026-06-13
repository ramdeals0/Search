import type { NextConfig } from "next";

const searchApiUrl =
  process.env.SEARCH_API_URL ??
  process.env.NEXT_PUBLIC_SEARCH_API_URL ??
  "http://localhost:4001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/search-api/:path*",
        destination: `${searchApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
