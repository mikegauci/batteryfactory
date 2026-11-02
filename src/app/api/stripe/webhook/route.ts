import type Stripe from "stripe";
import { revalidateTag } from "next/cache";
import { fulfillSession, sendOrderEmails, stripeIsLive } from "@/lib/checkout";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
]);

// Stripe retries any non-2xx for up to three days, so a failure to record a
// paid order returns 500. Email failures don't: the reconciler retries them.
export async function POST(request: Request) {
  if (!env.stripeWebhookSecret)
    return new Response("Webhook unavailable", { status: 503 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      request.headers.get("stripe-signature") ?? "",
      env.stripeWebhookSecret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  // Test events never touch a live deployment, and the other way round.
  if (event.livemode !== stripeIsLive() || !HANDLED.has(event.type))
    return Response.json({ received: true });

  const db = createAdminClient();
  if (!db) return new Response("Webhook unavailable", { status: 503 });
  const session = event.data.object as Stripe.Checkout.Session;
  const checkoutId = session.metadata?.checkout_id;
  if (!checkoutId) return Response.json({ received: true });

  try {
    if (event.type === "checkout.session.expired") {
      const r = await db.rpc("release_shop_checkout", {
        checkout_id: checkoutId,
      });
      if (r.error) throw r.error;
      revalidateTag("products", "max");
      return Response.json({ received: true });
    }
    const order = await fulfillSession(db, session.id);
    if (order) await sendOrderEmails(db, checkoutId);
    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe fulfillment failed", event.id, error);
    return new Response("Please retry", { status: 500 });
  }
}
