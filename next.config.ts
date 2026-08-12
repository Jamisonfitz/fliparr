import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone for a small Docker image (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
