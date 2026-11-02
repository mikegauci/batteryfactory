import type { Tables } from "@/lib/supabase/database.types";
import type { MediaInfo } from "@/lib/media-info";
export type Variant = Tables<"product_variants"> & { image: MediaInfo | null };
export type Product = Tables<"products"> & {
  image: MediaInfo | null;
  variants: Variant[];
  gallery: { image: MediaInfo | null; sort_order: number }[];
};
export type CartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  options: Record<string, string>;
};
export const price = (p: {
  price_cents: number | null;
  sale_price_cents: number | null;
}) => p.sale_price_cents ?? p.price_cents ?? 0;
export const available = (
  p: {
    stock_status: string;
    manage_stock: boolean;
    stock_quantity: number | null;
  },
  quantity = 1,
) =>
  p.stock_status !== "out_of_stock" &&
  (!p.manage_stock || (p.stock_quantity ?? 0) >= quantity);
export function priceLabel(p: Product, format: (n: number) => string) {
  const values = p.variants.length ? p.variants.map(price) : [price(p)];
  const min = Math.min(...values),
    max = Math.max(...values);
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}
