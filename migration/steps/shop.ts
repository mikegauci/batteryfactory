// WooCommerce -> shop tables: categories, tags, products with variants and
// galleries, then orders with their items and notes. WooCommerce charged no
// separate tax (prices include VAT), so vat_cents is the 18% inside the total.
import type { Context } from "../lib/context.ts";
import { maybeUnserialize } from "../lib/php.ts";
import { decodeEntities, wpDate } from "../lib/wp.ts";
import { seoFrom } from "./seo.ts";

const cents = (value: string | undefined | null) => {
  if (value == null || value.trim() === "") return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const STOCK: Record<string, "in_stock" | "out_of_stock" | "on_backorder"> = {
  instock: "in_stock",
  outofstock: "out_of_stock",
  onbackorder: "on_backorder",
};

const ORDER_STATUS = {
  "wc-pending": "pending",
  "wc-on-hold": "pending",
  "wc-processing": "processing",
  "wc-completed": "completed",
  "wc-cancelled": "cancelled",
  "wc-refunded": "refunded",
  "wc-failed": "failed",
} as const;

export function importShop(ctx: Context, users: Map<string, string>) {
  // ---------------------------------------------------------------- catalogue
  const products = ctx.wp.all(
    "select * from wp_posts where post_type = 'product' and post_status in ('publish', 'draft', 'private') order by menu_order, cast(ID as integer)",
  );
  const variations = ctx.wp.all(
    "select * from wp_posts where post_type = 'product_variation' and post_status in ('publish', 'private') order by menu_order, cast(ID as integer)",
  );
  const meta = ctx.wp.postMeta([...products, ...variations].map((p) => p.ID!));

  const categories = new Map<string, Record<string, unknown>>();
  const tags = new Map<string, Record<string, unknown>>();
  const categoryLinks: { product_id: string; category_id: string }[] = [];
  const tagLinks: { product_id: string; tag_id: string }[] = [];
  const gallery: {
    product_id: string;
    media_id: string;
    sort_order: number;
  }[] = [];
  // product wp id -> { attribute key -> display name }
  const attributeNames = new Map<string, Map<string, string>>();

  // Advanced Product Fields groups: checkbox add-ons with a fixed price,
  // attached to products by their "product is" rules.
  const addonsByProduct = new Map<
    string,
    { id: string; label: string; price_cents: number }[]
  >();
  for (const group of ctx.wp.all(
    "select post_content from wp_posts where post_type = 'wapf_product' and post_status = 'publish'",
  )) {
    const data = maybeUnserialize(group.post_content ?? null);
    if (!data || typeof data !== "object") continue;
    const choices = Object.values(data.fields ?? {}).flatMap((field) =>
      field && typeof field === "object" && field.type === "checkboxes"
        ? Object.values(field.options?.choices ?? {})
        : [],
    );
    type Choice = {
      slug: string;
      label: string;
      pricing_type: string;
      pricing_amount: number;
    };
    const addons = (choices as Choice[])
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        id: String(c.slug),
        label: decodeEntities(String(c.label)).trim(),
        price_cents:
          c.pricing_type === "fixed"
            ? Math.round(Number(c.pricing_amount) * 100)
            : 0,
      }));
    for (const ruleGroup of Object.values(data.rule_groups ?? {}))
      for (const rule of Object.values(
        (ruleGroup as { rules?: object }).rules ?? {},
      ))
        for (const v of Object.values(
          (rule as { value?: object }).value ?? {},
        )) {
          const productId = String((v as { id?: string }).id ?? "");
          if (productId)
            addonsByProduct.set(productId, [
              ...(addonsByProduct.get(productId) ?? []),
              ...addons,
            ]);
        }
  }

  const productRows = products.map((p, index) => {
    const id = ctx.id("products", p.ID!);
    const m = meta.get(p.ID!) ?? new Map<string, string>();
    for (const t of ctx.wp.termsFor(p.ID!, "product_cat")) {
      const cid = ctx.id("product_categories", t.term_id!);
      const thumb = ctx.wp.get(
        "select meta_value from wp_termmeta where term_id = ? and meta_key = 'thumbnail_id'",
        t.term_id!,
      );
      categories.set(t.term_id!, {
        id: cid,
        wp_id: Number(t.term_id),
        slug: t.slug,
        name: decodeEntities(t.name!),
        description: t.description ?? "",
        image_media_id: ctx.media.byAttachment(thumb?.meta_value)?.id ?? null,
      });
      categoryLinks.push({ product_id: id, category_id: cid });
    }
    for (const t of ctx.wp.termsFor(p.ID!, "product_tag")) {
      const tid = ctx.id("product_tags", t.term_id!);
      tags.set(t.term_id!, {
        id: tid,
        wp_id: Number(t.term_id),
        slug: t.slug,
        name: decodeEntities(t.name!),
      });
      tagLinks.push({ product_id: id, tag_id: tid });
    }
    for (const [order, mediaId] of (m.get("_product_image_gallery") ?? "")
      .split(",")
      .filter(Boolean)
      .entries()) {
      const ref = ctx.media.byAttachment(mediaId);
      if (ref)
        gallery.push({ product_id: id, media_id: ref.id, sort_order: order });
    }

    // Custom (non-taxonomy) attributes used for variations: "S | M | L".
    const attrs = maybeUnserialize(m.get("_product_attributes") ?? null);
    const options: { name: string; values: string[] }[] = [];
    const names = new Map<string, string>();
    if (attrs && typeof attrs === "object") {
      for (const [key, a] of Object.entries(attrs)) {
        if (!a || typeof a !== "object" || a.is_variation !== 1) continue;
        const name = decodeEntities(String(a.name));
        names.set(key, name);
        options.push({
          name,
          values: String(a.value)
            .split("|")
            .map((s) => decodeEntities(s.trim()))
            .filter(Boolean),
        });
      }
    }
    attributeNames.set(p.ID!, names);

    return {
      id,
      wp_id: Number(p.ID),
      slug: p.post_name!,
      name: decodeEntities(p.post_title!),
      short_description: ctx.html(p.post_excerpt),
      description: ctx.html(p.post_content),
      sku: m.get("_sku") || null,
      price_cents: cents(m.get("_regular_price")) ?? cents(m.get("_price")),
      sale_price_cents: cents(m.get("_sale_price")),
      manage_stock: m.get("_manage_stock") === "yes",
      stock_quantity:
        m.get("_manage_stock") === "yes"
          ? Number.parseInt(m.get("_stock") ?? "0", 10)
          : null,
      stock_status: STOCK[m.get("_stock_status") ?? "instock"] ?? "in_stock",
      options,
      featured_media_id:
        ctx.media.byAttachment(m.get("_thumbnail_id"))?.id ?? null,
      // Virtual products are services here (e.g. battery servicing), so they
      // stay published like on the live shop.
      status:
        p.post_status === "publish" && m.get("_downloadable") !== "yes"
          ? ("published" as const)
          : ("draft" as const),
      contact_button: m.get("_enable_contact_us_button") === "yes",
      addons: addonsByProduct.get(p.ID!) ?? [],
      sort_order: index,
      seo: seoFrom(ctx, m, p.post_title ?? ""),
      created_at: wpDate(p.post_date_gmt, p.post_date) ?? undefined,
    };
  });

  const productIds = new Set(products.map((p) => p.ID!));
  const rawVariantRows = variations
    .filter((v) => productIds.has(v.post_parent!))
    .map((v, index) => {
      const m = meta.get(v.ID!) ?? new Map<string, string>();
      const names = attributeNames.get(v.post_parent!) ?? new Map();
      const optionValues: Record<string, string> = Object.fromEntries(
        [...names.values()].map((name) => [name, ""]),
      );
      for (const [key, value] of m) {
        if (!key.startsWith("attribute_")) continue;
        const attr = key.slice("attribute_".length);
        // Obsolete attributes are ignored by WooCommerce. Empty values are wildcards.
        const name = names.get(attr);
        if (name) optionValues[name] = decodeEntities(value);
      }
      return {
        id: ctx.id("product_variants", v.ID!),
        wp_id: Number(v.ID),
        product_id: ctx.id("products", v.post_parent!),
        option_values: optionValues,
        sku: m.get("_sku") || null,
        price_cents:
          cents(m.get("_regular_price")) ?? cents(m.get("_price")) ?? 0,
        sale_price_cents: cents(m.get("_sale_price")),
        manage_stock: m.get("_manage_stock") === "yes",
        stock_quantity:
          m.get("_manage_stock") === "yes"
            ? Number.parseInt(m.get("_stock") ?? "0", 10)
            : null,
        stock_status: STOCK[m.get("_stock_status") ?? "instock"] ?? "in_stock",
        image_media_id:
          ctx.media.byAttachment(m.get("_thumbnail_id"))?.id ?? null,
        sort_order: index,
      };
    });

  // WooCommerce selects the first matching variation in menu order.
  const seenVariants = new Set<string>();
  const variantRows = rawVariantRows.filter((v) => {
    const key = `${v.product_id}:${JSON.stringify(v.option_values)}`;
    if (seenVariants.has(key)) return false;
    seenVariants.add(key);
    return true;
  });

  ctx.upsert("product_categories", [...categories.values()] as never[], "id");
  ctx.upsert("product_tags", [...tags.values()] as never[], "id");
  ctx.upsert("products", productRows, "id");
  ctx.upsert("product_variants", variantRows, "id");
  ctx.upsert("product_media", gallery, "product_id,media_id");
  ctx.upsert("product_category_links", categoryLinks, "product_id,category_id");
  ctx.upsert("product_tag_links", tagLinks, "product_id,tag_id");
  ctx.count("shop: products", productRows.length);
  ctx.count("shop: variants", variantRows.length);
  ctx.count("shop: categories", categories.size);
  ctx.count(
    "shop: products with add-ons",
    productRows.filter((p) => p.addons.length).length,
  );

  // ---------------------------------------------------------------- orders
  const orders = ctx.wp.all(
    "select * from wp_posts where post_type = 'shop_order' order by cast(ID as integer)",
  );
  const orderMeta = ctx.wp.postMeta(orders.map((o) => o.ID!));
  const variantIds = new Set(variantRows.map((v) => v.wp_id));
  const productWpIds = new Set(productRows.map((p) => p.wp_id));

  const wpUserByEmail = new Map(
    ctx.wp
      .all("select ID, user_email from wp_users")
      .map((u) => [u.user_email!.trim().toLowerCase(), u.ID!]),
  );
  const orderRows = [];
  const itemRows = [];
  const noteRows = [];
  let revenue = 0;
  for (const o of orders) {
    const m = orderMeta.get(o.ID!) ?? new Map<string, string>();
    const status = ORDER_STATUS[o.post_status as keyof typeof ORDER_STATUS];
    if (!status) {
      ctx.warn(
        `shop: order ${o.ID} has unknown status ${o.post_status}; skipped`,
      );
      continue;
    }
    const id = ctx.id("orders", o.ID!);
    const address = (prefix: string) => {
      const out: Record<string, string> = {};
      for (const f of [
        "first_name",
        "last_name",
        "company",
        "address_1",
        "address_2",
        "city",
        "postcode",
        "country",
        "phone",
      ]) {
        const value = m.get(`_${prefix}_${f}`)?.trim();
        if (value) out[f] = value;
      }
      return out;
    };

    const items = ctx.wp.all(
      "select * from wp_woocommerce_order_items where order_id = ?",
      o.ID!,
    );
    let subtotal = 0;
    let shippingMethod = "";
    for (const item of items) {
      const im = new Map(
        ctx.wp
          .all(
            "select meta_key, meta_value from wp_woocommerce_order_itemmeta where order_item_id = ?",
            item.order_item_id!,
          )
          .map((r) => [r.meta_key!, r.meta_value ?? ""]),
      );
      if (item.order_item_type === "shipping") {
        shippingMethod = decodeEntities(item.order_item_name ?? "");
        continue;
      }
      if (item.order_item_type !== "line_item") continue;
      const qty = Math.max(1, Number.parseInt(im.get("_qty") ?? "1", 10));
      const total = cents(im.get("_line_total")) ?? 0;
      subtotal += cents(im.get("_line_subtotal")) ?? total;
      const productId = im.get("_product_id");
      const variationId = im.get("_variation_id");
      const names = attributeNames.get(productId ?? "") ?? new Map();
      const optionValues: Record<string, string> = {};
      for (const [key, value] of im) {
        if (
          key.startsWith("_") ||
          [
            "Items",
            "method_id",
            "instance_id",
            "cost",
            "total_tax",
            "taxes",
          ].includes(key)
        )
          continue;
        optionValues[names.get(key) ?? key] = decodeEntities(value);
      }
      itemRows.push({
        id: ctx.id("order_items", item.order_item_id!),
        order_id: id,
        product_id:
          productId && productWpIds.has(Number(productId))
            ? ctx.id("products", productId)
            : null,
        variant_id:
          variationId && variantIds.has(Number(variationId))
            ? ctx.id("product_variants", variationId)
            : null,
        name: decodeEntities(item.order_item_name ?? ""),
        option_values: optionValues,
        quantity: qty,
        unit_price_cents: Math.round(total / qty),
        total_cents: total,
      });
    }

    const email = (m.get("_billing_email") ?? "").trim().toLowerCase();
    const total = cents(m.get("_order_total")) ?? 0;
    if (status === "processing" || status === "completed") revenue += total;
    const paid = m.get("_date_paid");
    orderRows.push({
      id,
      wp_id: Number(o.ID),
      number: Number(o.ID),
      // Guest checkouts are linked to the account with the same email, if any.
      customer_id:
        users.get(m.get("_customer_user") ?? "") ??
        users.get(wpUserByEmail.get(email) ?? "") ??
        null,
      email,
      status,
      currency: m.get("_order_currency") || "EUR",
      subtotal_cents: subtotal,
      discount_cents: cents(m.get("_cart_discount")) ?? 0,
      shipping_cents: cents(m.get("_order_shipping")) ?? 0,
      vat_cents: Math.round((total * 18) / 118),
      total_cents: total,
      billing_address: address("billing"),
      shipping_address: address("shipping"),
      shipping_method: shippingMethod,
      payment_method: m.get("_payment_method") ?? "",
      stripe_payment_intent_id: m.get("_stripe_intent_id") || null,
      customer_note: o.post_excerpt ?? "",
      paid_at: paid ? new Date(Number(paid) * 1000).toISOString() : null,
      created_at: wpDate(o.post_date_gmt, o.post_date) ?? undefined,
    });

    for (const note of ctx.wp.all(
      "select * from wp_comments where comment_post_ID = ? and comment_type = 'order_note'",
      o.ID!,
    )) {
      noteRows.push({
        id: ctx.id("order_notes", note.comment_ID!),
        order_id: id,
        body: decodeEntities(note.comment_content ?? ""),
        customer_visible: false,
        created_at:
          wpDate(note.comment_date_gmt, note.comment_date) ?? undefined,
      });
    }
  }

  ctx.upsert("orders", orderRows, "id");
  ctx.upsert("order_items", itemRows, "id");
  ctx.upsert("order_notes", noteRows, "id");
  ctx.count("shop: orders", orderRows.length);
  ctx.count("shop: order items", itemRows.length);
  ctx.count("shop: order notes", noteRows.length);
  ctx.count(
    "shop: paid revenue (processing/completed)",
    `€${(revenue / 100).toFixed(2)}`,
  );
}
