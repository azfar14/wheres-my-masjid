import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Prevent Next.js from picking a parent folder when multiple package-lock.json
    // files exist on the Windows machine.
    root: process.cwd()
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
