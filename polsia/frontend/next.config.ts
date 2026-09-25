import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone so the Docker image ships without node_modules.
  output: "standalone",
  // This app is nested inside another Next.js repo; pin the root so neither
  // Turbopack nor output tracing climbs into the parent project.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
