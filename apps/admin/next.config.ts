import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@presslyn/ui", "@presslyn/api", "@presslyn/core", "@presslyn/database"],
  serverExternalPackages: ["argon2", "sharp", "postgres", "file-type"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("argon2", "sharp", "postgres", "file-type");
    }
    return config;
  },
};

export default nextConfig;
