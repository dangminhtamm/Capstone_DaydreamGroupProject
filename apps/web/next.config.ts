import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly root the project at src/ so Turbopack doesn't scan for a
  // root-level app/ directory and emit ENOENT errors on every hot-reload.
  srcDir: "src",
};

export default nextConfig;
