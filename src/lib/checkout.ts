import "server-only";
import type Stripe from "stripe";
import { revalidateTag } from "next/cache";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import type { CustomerDetails } from "@/lib/checkout-details";
import { formatPrice } from "@/lib/format";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

// Server-side checkout lifecycle shared by the checkout route, the Stripe
// webhook and the reconciler:
//   reserve stock -> create Stripe session -> paid (order) | released
// Every step can be retried: Stripe calls use the checkout id as idempotency
// key, fulfilment is idempotent in SQL, and emails are tracked per checkout.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Checkout = Database["public"]["Tables"]["shop_checkouts"]["Row"];

// How long a reservation holds stock. Stripe sessions expire after 30
// minutes; the extra time lets Stripe's own "expired" event arrive first.
export const SESSION_MINUTES = 30;
export const RESERVATION_MINUTES = 35;

// Network errors and Stripe 5xx/429 leave it unknown whether the session
// was created; everything else is a definite "no".
function isAmbiguous(error: unknown) {
  const type = (error as { type?: string } | null)?.type;
  return (
    type === "StripeConnectionError" ||
    type === "StripeAPIError" ||
    type === "StripeRateLimitError" ||
    !type
  );
}

async function saveSession(
  db: Admin,
  id: string,
  session: Stripe.Checkout.Session,
) {
  const { error } = await db
    .from("shop_checkouts")
    .update({
      stripe_session_id: session.id,
      stripe_session_url: session.url,
      last_error: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) console.error("Could not save Stripe session", id, error.message);
}

// Creates the Stripe session for a reserved checkout. The exact request is
// stored first, then sent with the checkout id as idempotency key, and an
// ambiguous failure is retried once with the same key (Stripe returns the
// original session if the first attempt reached it).
export async function createCheckoutSession(
  db: Admin,
  checkoutId: string,
  params: Stripe.Checkout.SessionCreateParams,
): Promise<
  { ok: true; url: string } | { ok: false; definite: boolean; message: string }
> {
  const { stripe } = await getStripe(db);
  const stored = await db
    .from("shop_checkouts")
    .update({ stripe_request: params as unknown as Json })
    .eq("id", checkoutId);
  if (stored.error)
    return { ok: false, definite: true, message: stored.error.message };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: checkoutId,
        timeout: 15_000,
        maxNetworkRetries: 1,
      });
      await saveSession(db, checkoutId, session);
      if (!session.url) throw new Error("Stripe returned no checkout URL");
      return { ok: true, url: session.url };
    } catch (error) {
      lastError = error;
      if (!isAmbiguous(error)) break;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : "Stripe request failed";
  await db
    .from("shop_checkouts")
    .update({
      last_error: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkoutId);
  return { ok: false, definite: !isAmbiguous(lastError), message };
}

// Finds the Stripe session for a checkout whose id we never saved (timeout
// or crash), by scanning sessions created around the reservation time.
async function findSession(stripe: Stripe, checkout: Checkout) {
  if (checkout.stripe_session_id)
    return stripe.checkout.sessions.retrieve(checkout.stripe_session_id);
  const created = Math.floor(new Date(checkout.created_at).getTime() / 1000);
  for await (const session of stripe.checkout.sessions.list({
    created: { gte: created - 120, lte: created + 1800 },
    limit: 100,
  })) {
    if (session.metadata?.checkout_id === checkout.id) return session;
  }
  return null;
}

function address(
  detail:
    | {
        name?: string | null;
        address?: Stripe.Address | null;
        phone?: string | null;
      }
    | null
    | undefined,
) {
  const parts = (detail?.name ?? "").trim().split(/\s+/);
  return {
    first_name: parts.shift() ?? "",
    last_name: parts.join(" "),
    address_1: detail?.address?.line1 ?? "",
    address_2: detail?.address?.line2 ?? "",
    city: detail?.address?.city ?? "",
    postcode: detail?.address?.postal_code ?? "",
    country: detail?.address?.country ?? "",
    phone: detail?.phone ?? "",
  };
}

async function customerFor(
  db: Admin,
  email: string,
  name: { first_name: string; last_name: string },
) {
  const found = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (found.error) throw found.error;
  if (found.data) return found.data.id;
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { account_type: "customer", ...name },
  });
  if (!created.error) return created.data.user.id;
  // Another delivery of the same event may have created it meanwhile.
  const retry = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!retry.data) throw created.error;
  return retry.data.id;
}

// Turns a paid Stripe session into an order (idempotent). Returns the order
// id, or null when the session is not paid yet.
export async function fulfillSession(
  db: Admin,
  sessionId: string,
): Promise<string | null> {
  const { stripe } = await getStripe(db);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const id = session.metadata?.checkout_id;
  if (!id || session.payment_status !== "paid") return null;
  // Details entered on our checkout page; older sessions collected them in Stripe.
  const { data: stored } = await db
    .from("shop_checkouts")
    .select("customer_details")
    .eq("id", id)
    .maybeSingle();
  const details = stored?.customer_details as CustomerDetails | null;
  const email = details?.billing.email ?? session.customer_details?.email;
  if (!email || session.currency !== "eur") throw new Error("Invalid payment");
  const delivery =
    details?.shipping ??
    address(session.collected_information?.shipping_details);
  const billing = details?.billing ?? address(session.customer_details);
  if (delivery.country !== "MT")
    throw new Error("Unsupported delivery country");
  const customer = await customerFor(db, email, billing);
  const result = await db.rpc("complete_shop_checkout", {
    checkout_id: id,
    session_id: session.id,
    payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    email_address: email,
    customer,
    billing: billing as Json,
    shipping_address_input: delivery as Json,
    paid_total: session.amount_total ?? -1,
  });
  if (result.error) throw result.error;
  revalidateTag("products", "max");
  return result.data;
}

// Sends whichever order emails are still pending. Never throws: failures are
// recorded on the checkout and retried by the reconciler.
export async function sendOrderEmails(db: Admin, checkoutId: string) {
  const { data: c } = await db
    .from("shop_checkouts")
    .select("id,order_id,customer_email_sent,admin_email_sent,livemode")
    .eq("id", checkoutId)
    .single();
  if (!c?.order_id || (c.customer_email_sent && c.admin_email_sent)) return;
  const { data: order } = await db
    .from("orders")
    .select("*,items:order_items(*)")
    .eq("id", c.order_id)
    .single();
  if (!order) return;
  const delivery = order.shipping_address as Record<string, string>;
  const prefix = c.livemode ? "" : "[TEST] ";
  const content = {
    heading: `Order #${order.number}`,
    paragraphs: [
      "Thank you for your order. We have received your payment.",
      order.shipping_method,
    ],
    rows: [
      ...order.items.map((i) => ({
        label: `${i.quantity} × ${i.name} ${[
          ...Object.values((i.option_values ?? {}) as Record<string, string>),
          ...((i.addons ?? []) as { label: string }[]).map((a) => a.label),
        ].join(" / ")}`.trim(),
        value: formatPrice(i.total_cents),
      })),
      { label: "Delivery", value: formatPrice(order.shipping_cents) },
      {
        label: "Total (includes 18% VAT)",
        value: formatPrice(order.total_cents),
      },
      { label: "VAT included", value: formatPrice(order.vat_cents) },
      {
        label: "Delivery address",
        value: Object.values(delivery ?? {})
          .filter(Boolean)
          .join(", "),
      },
    ],
  };
  const errors: string[] = [];
  if (!c.customer_email_sent) {
    const sent = await sendEmail({
      to: order.email,
      subject: `${prefix}Battery Factory order #${order.number}`,
      idempotencyKey: `order-${order.id}-customer`,
      ...content,
    });
    if (sent.ok)
      await db
        .from("shop_checkouts")
        .update({ customer_email_sent: true })
        .eq("id", c.id);
    else errors.push("customer email failed");
  }
  const adminTo = process.env.EMAIL_ADMIN_TO || "info@batteryfactory.mt";
  if (!c.admin_email_sent && !adminTo) {
    await db
      .from("shop_checkouts")
      .update({ admin_email_sent: true })
      .eq("id", c.id);
  } else if (!c.admin_email_sent && adminTo) {
    const sent = await sendEmail({
      to: adminTo,
      subject: `${prefix}New order #${order.number}`,
      idempotencyKey: `order-${order.id}-admin`,
      ...content,
      action: {
        label: "View order",
        href: `${env.siteUrl}/admin/orders/${order.id}/`,
      },
    });
    if (sent.ok)
      await db
        .from("shop_checkouts")
        .update({ admin_email_sent: true })
        .eq("id", c.id);
    else errors.push("admin email failed");
  }
  await db
    .from("shop_checkouts")
    .update({
      last_error: errors.join("; "),
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
}

// Settles lapsed reservations and retries pending emails. Safe to run often
// and concurrently: every action underneath is idempotent.
export async function reconcileCheckouts(limit = 20) {
  const db = createAdminClient();
  const shop = db && (await getStripe(db).catch(() => null));
  if (!db || !shop) return { settled: 0, emailed: 0 };
  const { stripe, live } = shop;
  let settled = 0;
  let emailed = 0;

  const { data: stale } = await db
    .from("shop_checkouts")
    .select("*")
    .eq("state", "reserved")
    .eq("livemode", live)
    .lt("expires_at", new Date().toISOString())
    .order("expires_at")
    .limit(limit);
  for (const checkout of stale ?? []) {
    try {
      const session = checkout.stripe_request
        ? await findSession(stripe, checkout)
        : null;
      if (session?.payment_status === "paid") {
        await fulfillSession(db, session.id);
        await sendOrderEmails(db, checkout.id);
      } else {
        // Close the session first so it can't be paid after the stock is
        // released (expiring an already-expired session is a no-op error).
        if (session?.status === "open")
          await stripe.checkout.sessions.expire(session.id).catch(() => null);
        const settledSession = session
          ? await stripe.checkout.sessions.retrieve(session.id)
          : null;
        if (settledSession?.payment_status === "paid") {
          await fulfillSession(db, settledSession.id);
          await sendOrderEmails(db, checkout.id);
        } else {
          const r = await db.rpc("release_shop_checkout", {
            checkout_id: checkout.id,
          });
          if (r.error) throw r.error;
          revalidateTag("products", "max");
        }
      }
      settled++;
    } catch (error) {
      console.error("Checkout reconcile failed", checkout.id, error);
      await db
        .from("shop_checkouts")
        .update({
          last_error: String(
            error instanceof Error ? error.message : error,
          ).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkout.id);
    }
  }

  // Emails are retried for a week after the checkout started.
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: unsent } = await db
    .from("shop_checkouts")
    .select("id")
    .eq("state", "paid")
    .eq("livemode", live)
    .or("customer_email_sent.eq.false,admin_email_sent.eq.false")
    .gt("created_at", week)
    .limit(limit);
  for (const c of unsent ?? []) {
    await sendOrderEmails(db, c.id);
    emailed++;
  }
  return { settled, emailed };
}
