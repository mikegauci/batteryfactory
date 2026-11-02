"use server";
import { assertAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { updateTag, revalidatePath } from "next/cache";
import type { Enums, Json, Tables } from "@/lib/supabase/database.types";
export type ProductInput = {
  id: string | null;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  sku: string | null;
  price_cents: number | null;
  sale_price_cents: number | null;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: Enums<"stock_status">;
  options: { name: string; values: string[] }[];
  featured_media_id: string | null;
  status: Enums<"publish_status">;
  sort_order: number;
  seo: { title?: string; description?: string; noindex?: boolean };
  gallery: string[];
  variants: Pick<
    Tables<"product_variants">,
    | "id"
    | "option_values"
    | "sku"
    | "price_cents"
    | "sale_price_cents"
    | "manage_stock"
    | "stock_quantity"
    | "stock_status"
    | "image_media_id"
  >[];
};
export async function saveProduct(
  input: ProductInput,
): Promise<{ error: string } | { id: string }> {
  await assertAdmin("products");
  const db = await createClient();
  const slug = slugify(input.slug || input.name);
  if (!input.name.trim() || !slug)
    return { error: "Add a product name and URL." };
  if (
    !["draft", "published"].includes(input.status) ||
    !["in_stock", "out_of_stock", "on_backorder"].includes(input.stock_status)
  )
    return { error: "Invalid status." };
  const stock = [input, ...input.variants];
  for (const p of stock) {
    if (!["in_stock", "out_of_stock", "on_backorder"].includes(p.stock_status))
      return { error: "Invalid stock status." };
    if (
      p.manage_stock &&
      (!Number.isInteger(p.stock_quantity) || p.stock_quantity! < 0)
    )
      return { error: "Stock must be a non-negative whole number." };
    for (const n of [p.price_cents, p.sale_price_cents])
      if (n !== null && (!Number.isSafeInteger(n) || n < 0 || n > 10000000))
        return { error: "Prices must be valid euro cents." };
    if (
      p.sale_price_cents !== null &&
      (p.price_cents === null || p.sale_price_cents > p.price_cents)
    )
      return { error: "Sale price must be no higher than regular price." };
  }
  if (!input.variants.length && input.price_cents === null)
    return { error: "Add a price." };
  if (
    input.options.some(
      (o) =>
        !o.name.trim() ||
        !o.values.length ||
        new Set(o.values).size !== o.values.length,
    ) ||
    new Set(input.options.map((o) => o.name)).size !== input.options.length
  )
    return { error: "Option names and values must be unique and nonempty." };
  const combinations = new Set<string>();
  for (const v of input.variants) {
    const values = v.option_values as Record<string, string>;
    if (
      !values ||
      Array.isArray(values) ||
      typeof values !== "object" ||
      Object.keys(values).length !== input.options.length ||
      input.options.some(
        (o) => values[o.name] !== "" && !o.values.includes(values[o.name]),
      )
    )
      return { error: "Each variant must choose a value for every option." };
    const combination = JSON.stringify(
      input.options.map((o) => values[o.name]),
    );
    if (combinations.has(combination))
      return { error: "Duplicate variant combination." };
    combinations.add(combination);
  }
  if (input.options.length && !input.variants.length)
    return { error: "Add variants for the product options." };
  const { id, gallery, variants, ...row } = input;
  const previous = id
    ? (await db.from("products").select("slug,status").eq("id", id).single())
        .data
    : null;
  if (id && !previous) return { error: "Product not found." };
  // Product, variants and gallery are written in one transaction.
  const saved = await db.rpc("admin_save_product", {
    target_id: id as string,
    product: { ...row, slug, name: row.name.trim() } as unknown as Json,
    variants: variants.map((v, i) => ({ ...v, sort_order: i })) as Json,
    gallery: [...new Set(gallery)],
  });
  if (saved.error)
    return {
      error:
        saved.error.code === "23505"
          ? "Another product already uses that URL, SKU or option combination."
          : saved.error.message,
    };
  const productId = saved.data;
  if (previous && previous.slug !== slug && previous.status === "published") {
    const r = await db.from("redirects").upsert(
      {
        source: `/product/${previous.slug}/`,
        destination: `/product/${slug}/`,
      },
      { onConflict: "source" },
    );
    if (r.error) return { error: r.error.message };
    await db.from("redirects").delete().eq("source", `/product/${slug}/`);
  }
  updateTag("products");
  updateTag(`product:${slug}`);
  if (previous) updateTag(`product:${previous.slug}`);
  revalidatePath("/admin/products/");
  return { id: productId };
}
// Copies a product as a draft with a free URL; SKUs are cleared because they must be unique.
export async function duplicateProduct(
  sourceId: string,
): Promise<{ error: string } | { id: string }> {
  await assertAdmin("products");
  const db = await createClient();
  const { data: p, error } = await db
    .from("products")
    .select(
      "*,variants:product_variants(*),gallery:product_media(media_id,sort_order),categories:product_category_links(category_id),tags:product_tag_links(tag_id)",
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!p) return { error: "Product not found." };
  const base = `${p.slug}-copy`;
  const { data: taken } = await db
    .from("products")
    .select("slug")
    .like("slug", `${base}%`);
  const used = new Set(taken?.map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  const saved = await db.rpc("admin_save_product", {
    target_id: null as unknown as string,
    product: {
      name: `${p.name} (copy)`,
      slug,
      short_description: p.short_description,
      description: p.description,
      sku: null,
      price_cents: p.price_cents,
      sale_price_cents: p.sale_price_cents,
      manage_stock: p.manage_stock,
      stock_quantity: p.stock_quantity,
      stock_status: p.stock_status,
      options: p.options,
      featured_media_id: p.featured_media_id,
      status: "draft",
      sort_order: p.sort_order,
      seo: p.seo,
    } as Json,
    variants: p.variants
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v, i) => ({
        id: crypto.randomUUID(),
        option_values: v.option_values,
        sku: null,
        price_cents: v.price_cents,
        sale_price_cents: v.sale_price_cents,
        manage_stock: v.manage_stock,
        stock_quantity: v.stock_quantity,
        stock_status: v.stock_status,
        image_media_id: v.image_media_id,
        sort_order: i,
      })) as Json,
    gallery: p.gallery
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => g.media_id),
  });
  if (saved.error) return { error: saved.error.message };
  const id = saved.data;
  if (p.categories.length) {
    const r = await db.from("product_category_links").insert(
      p.categories.map((c) => ({ product_id: id, category_id: c.category_id })),
    );
    if (r.error) return { error: r.error.message };
  }
  if (p.tags.length) {
    const r = await db
      .from("product_tag_links")
      .insert(p.tags.map((t) => ({ product_id: id, tag_id: t.tag_id })));
    if (r.error) return { error: r.error.message };
  }
  updateTag("products");
  revalidatePath("/admin/products/");
  return { id };
}
