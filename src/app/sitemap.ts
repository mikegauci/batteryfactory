import { getStandalonePages } from "@/lib/static-pages";
import { RESERVED_SLUGS } from "@/lib/slug";
import type { Seo } from "@/lib/seo";
import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getProducts } from "@/lib/shop";

// Replaces Yoast's sitemap index (old *-sitemap.xml URLs redirect here).
// Cart, checkout and account pages are noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, pages] = await Promise.all([
    getProducts(),
    getStandalonePages(),
  ]);
  const url = (path: string, lastModified?: string | null) => ({
    url: `${env.siteUrl}${path}`,
    ...(lastModified ? { lastModified } : {}),
  });

  return [
    ...["/", "/shop-batteries-and-accessories/"].map((path) => url(path)),
    ...pages
      .filter(
        (p) => p.path && !RESERVED_SLUGS.has(p.path) && !(p.seo as Seo).noindex,
      )
      .map((p) => url(`/${p.path}/`, p.updated_at)),
    ...products.map((p) => url(`/product/${p.slug}/`)),
  ];
}
