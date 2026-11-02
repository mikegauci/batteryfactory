import { randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  createCheckoutSession,
  reconcileCheckouts,
  RESERVATION_MINUTES,
  SESSION_MINUTES,
  stripeIsLive,
} from "@/lib/checkout";
import { env } from "@/lib/env";
import { publicDb } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { PRODUCT_SELECT, getShopSettings } from "@/lib/shop";
import { available, price, type Product } from "@/lib/shop-types";
import type { Json } from "@/lib/supabase/database.types";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  // Enable only after recovery/reconciliation and payment acceptance checks.
  if (process.env.SHOP_CHECKOUT_ENABLED !== "true")
    return Response.json(
      {
        error: "Online payments are not available yet. Please try again later.",
      },
      { status: 503 },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request." }, { status: 403 });
  let reserved: string | null = null;
  const db = createAdminClient();
  // Settle lapsed reservations and pending emails after responding.
  after(() => reconcileCheckouts().catch(() => undefined));
  try {
    if (!db || !env.stripeSecretKey)
      throw new Error("Payments are not configured yet.");
    const text = await request.text();
    if (text.length > 16000)
      return Response.json({ error: "Cart is too large." }, { status: 400 });
    const body = JSON.parse(text);
    if (
      !Array.isArray(body.items) ||
      body.items.length < 1 ||
      body.items.length > 50
    )
      throw new Error("Add products to your cart first.");
    const requested = body.items as {
      productId: string;
      variantId: string | null;
      quantity: number;
      options?: Record<string, string>;
    }[];
    const seen = new Set<string>();
    for (const item of requested) {
      if (
        !UUID.test(item.productId) ||
        !(item.variantId === null || UUID.test(item.variantId)) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      )
        throw new Error("Invalid cart item.");
      const key = `${item.variantId ?? item.productId}:${JSON.stringify(Object.entries(item.options ?? {}).sort())}`;
      if (seen.has(key)) throw new Error("Duplicate cart item.");
      seen.add(key);
    }
    const { data, error } = await publicDb
      .from("products")
      .select(PRODUCT_SELECT)
      .in(
        "id",
        requested.map((i) => i.productId),
      )
      .eq("status", "published");
    if (error) throw new Error("Could not load products. Please try again.");
    const products = data as unknown as Product[];
    const lines = requested.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      const v = p?.variants.find((v) => v.id === i.variantId);
      if (
        !p ||
        !available(p, i.quantity) ||
        (p.variants.length
          ? !v || !available(v, i.quantity)
          : i.variantId !== null) ||
        (v ?? p).price_cents === null
      )
        throw new Error("A product is unavailable. Please check your cart.");
      const definitions = p.options as { name: string; values: string[] }[];
      const selected = i.options ?? {};
      if (
        definitions.some((o) => !o.values.includes(selected[o.name])) ||
        Object.keys(selected).some(
          (key) => !definitions.some((o) => o.name === key),
        ) ||
        (v &&
          Object.entries(v.option_values as Record<string, string>).some(
            ([key, value]) => value && selected[key] !== value,
          ))
      )
        throw new Error("Choose a valid value for every product option.");
      return {
        product_id: p.id,
        variant_id: v?.id ?? null,
        name: p.name,
        sku: v?.sku ?? p.sku,
        quantity: i.quantity,
        unit_price_cents: price(v ?? p),
        option_values: selected,
      };
    });
    const settings = await getShopSettings();
    const shipping = settings.shipping.find((s) => s.countries.includes("MT"));
    if (!shipping || !settings.prices_include_vat || settings.vat_rate !== 0.18)
      throw new Error("Delivery is unavailable. Please contact us.");
    const user = await getCurrentUser();
    const id = randomUUID();
    const now = Date.now();
    const reservation = await db.rpc("reserve_shop_checkout", {
      checkout_id: id,
      customer: user?.id ?? null,
      lines: lines as Json,
      shipping: shipping.price_cents,
      shipping_label: shipping.label,
      vat: settings.vat_rate,
      live: stripeIsLive(),
      expires: new Date(now + RESERVATION_MINUTES * 60_000).toISOString(),
    });
    if (reservation.error)
      throw new Error(
        "Stock or prices have changed. Please refresh your cart and try again.",
      );
    reserved = id;
    const result = await createCheckoutSession(db, id, {
      mode: "payment",
      allowed_payment_method_types: ["card"],
      customer_email: user?.email,
      customer_creation: "always",
      client_reference_id: id,
      metadata: { checkout_id: id },
      expires_at: Math.floor(now / 1000) + SESSION_MINUTES * 60,
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["MT"] },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: shipping.label,
            type: "fixed_amount",
            fixed_amount: { amount: shipping.price_cents, currency: "eur" },
          },
        },
      ],
      line_items: lines.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: "eur",
          unit_amount: i.unit_price_cents,
          product_data: {
            name: i.name,
            description:
              Object.values(i.option_values as Record<string, string>).join(
                " / ",
              ) || undefined,
          },
        },
      })),
      success_url: `${env.siteUrl}/checkout/order-received/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.siteUrl}/checkout/`,
    });
    if (result.ok) return Response.json({ url: result.url });
    if (result.definite) {
      // Stripe refused the request, so no session exists: free the stock.
      await db.rpc("release_shop_checkout", { checkout_id: id });
      reserved = null;
      throw new Error("Payment could not be started. Please try again.");
    }
    // Unknown whether Stripe created the session: keep the stock reserved;
    // the reconciler expires the session and releases it.
    return Response.json(
      {
        error:
          "The payment service didn’t respond. Please wait a minute and try again.",
      },
      { status: 503 },
    );
  } catch (e) {
    // Only reached before the Stripe request, or after a definite refusal.
    if (reserved && db) {
      const release = await db.rpc("release_shop_checkout", {
        checkout_id: reserved,
      });
      if (release.error)
        console.error("Checkout stock release failed", reserved);
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Checkout is unavailable." },
      { status: 400 },
    );
  }
}
