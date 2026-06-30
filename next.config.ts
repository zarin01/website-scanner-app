import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chrome-launcher", "lighthouse"],
};

export default nextConfig;
