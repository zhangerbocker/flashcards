import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi load dev assets via the laptop's LAN address.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  devIndicators: false,
  // PGlite (local development database) loads WASM and data files at runtime; don't bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
