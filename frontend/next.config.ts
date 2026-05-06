import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: ['192.168.100.11', 'localhost:3000'],
  },
};

export default nextConfig;
