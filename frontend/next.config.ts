import type { NextConfig } from "next";

// Backend origin reachable from *inside* this container/process. In Docker
// this is the internal service DNS name (see docker-compose.*.yml); outside
// Docker it falls back to the locally running NestJS backend.
const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
