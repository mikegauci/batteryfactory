import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Keep the WordPress URL style (/product/x/, /cart/...) for SEO parity.
  trailingSlash: true,
  images: {
    remotePatterns: [
      new URL(
        "https://dvrjnuvpvkvoyndnrwqr.supabase.co/storage/v1/object/public/**",
      ),
    ],
  },
  partialPrefetching: true,
  // Safety cap for admin uploads through Server Actions.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
