import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: "http://localhost:8080/api/v1/:path*" },
      { source: "/internal/:path*", destination: "http://localhost:8080/internal/:path*" },
    ];
  },
};

export default nextConfig;
