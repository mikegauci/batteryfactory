import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
import type { Product } from "./shop-types";
export const PRODUCT_SELECT =
  "*, image:media!products_featured_media_id_fkey(path,width,height,alt), variants:product_variants(*, image:media(path,width,height,alt)), gallery:product_media(sort_order,image:media(path,width,height,alt))";
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const { data, error } = await publicDb
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .order("name");
  if (error) throw error;
  return data as unknown as Product[];
}
export async function getProduct(slug: string) {
  "use cache";
  cacheTag("products", `product:${slug}`);
  cacheLife("hours");
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}
export async function getShopSettings() {
  const { data, error } = await publicDb
    .from("settings")
    .select("value")
    .eq("key", "shop")
    .single();
  if (error) throw error;
  return data.value as {
    vat_rate: number;
    prices_include_vat: boolean;
    shipping: {
      id: string;
      label: string;
      countries: string[];
      price_cents: number;
    }[];
  };
}

// Historical meals remain available to the Events archive at their original URLs.
export async function getCatalogueProducts() {
  const hidden = new Set([
    "bbq-evening-set-menu-at-omc-clubhouse",
    "geared-up-fridays-american-style",
    "geared-up-fridays-italian-style-set-menu",
  ]);
  return (await getProducts()).filter((p) => !hidden.has(p.slug));
}
