import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { isLiveSite } from "@/lib/seo";

// Only batteryfactory.mt is indexed: previews and the Vercel alias block all crawlers.
export default function robots(): MetadataRoute.Robots {
  if (!isLiveSite) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/admin/",
        "/api/",
        "/auth/",
        "/preview/",
        "/cart/",
        "/checkout/",
        "/my-business/",
      ],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
