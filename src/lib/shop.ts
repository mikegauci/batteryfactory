import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
import type { Category, Product } from "./shop-types";
export const PRODUCT_SELECT =
  "*, image:media!products_featured_media_id_fkey(path,width,height,alt), variants:product_variants(*, image:media(path,width,height,alt)), gallery:product_media(sort_order,image:media(path,width,height,alt)), categories:product_category_links(category:product_categories(id,slug,name,parent_id))";

// Published products in WooCommerce's default order (menu order, then name).
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

// Categories with at least one published product, as in the shop sidebar.
export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  const used = new Map<string, Category>();
  for (const p of await getProducts())
    for (const { category } of p.categories)
      if (category) used.set(category.id, category);
  return [...used.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type ShopSettings = {
  vat_rate: number;
  prices_include_vat: boolean;
  // Orders at or above this subtotal ship free (Malta & Gozo).
  free_shipping_min_cents?: number;
  shipping: {
    id: string;
    label: string;
    countries: string[];
    price_cents: number;
  }[];
};
export async function getShopSettings() {
  const { data, error } = await publicDb
    .from("settings")
    .select("value")
    .eq("key", "shop")
    .single();
  if (error) throw error;
  return data.value as ShopSettings;
}

// Shipping for a cart subtotal: free from the threshold, else the rate.
export function shippingFor(settings: ShopSettings, subtotalCents: number) {
  const rate = settings.shipping.find((s) => s.countries.includes("MT"));
  if (!rate) return null;
  const free =
    settings.free_shipping_min_cents !== undefined &&
    subtotalCents >= settings.free_shipping_min_cents;
  return {
    label: free ? "Free Delivery" : rate.label,
    price_cents: free ? 0 : rate.price_cents,
  };
}

export async function getWhatsappUrl() {
  "use cache";
  cacheTag("site-settings");
  cacheLife("hours");
  const { data } = await publicDb
    .from("settings")
    .select("value")
    .eq("key", "contact")
    .maybeSingle();
  const value = (data?.value ?? {}) as { whatsapp_url?: string };
  return value.whatsapp_url || "https://wa.link/i7g4z3";
}
