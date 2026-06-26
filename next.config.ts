import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-browser packages out of the bundle; load them at runtime.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
