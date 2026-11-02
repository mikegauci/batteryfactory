import type Stripe from "stripe";
import { revalidateTag } from "next/cache";
import { fulfillSession, sendOrderEmails, stripeIsLive } from "@/lib/checkout";
import { env } from "@/lib/env";
import {
  forgetConnection,
  getPlatformStripe,
  getStripeConnection,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
]);

// Connect webhook: Stripe sends the connected shop account's events here,
// signed with the secret stored when the account was linked
// (STRIPE_WEBHOOK_SECRET is the fallback for the local forwarder).
// Stripe retries any non-2xx for up to three days, so a failure to record a
// paid order returns 500. Email failures don't: the reconciler retries them.
export async function POST(request: Request) {
  const db = createAdminClient();
  if (!db || !env.stripeSecretKey)
    return new Response("Webhook unavailable", { status: 503 });
  const connection = await getStripeConnection(db).catch(() => null);
  const secrets = [connection?.webhook_secret, env.stripeWebhookSecret].filter(
    (s): s is string => Boolean(s),
  );
  if (!secrets.length)
    return new Response("Webhook unavailable", { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const stripe = getPlatformStripe();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {}
  }
  if (!event) return new Response("Invalid signature", { status: 400 });

  // Test events never touch a live deployment, and the other way round.
  // Events from any other account connected to the platform are ignored.
  if (
    event.livemode !== stripeIsLive() ||
    !connection ||
    event.account !== connection.account_id
  )
    return Response.json({ received: true });

  try {
    if (event.type === "account.application.deauthorized") {
      // The shop disconnected the site from its Stripe dashboard.
      await forgetConnection(db, connection.account_id);
      return Response.json({ received: true });
    }
    if (!HANDLED.has(event.type)) return Response.json({ received: true });
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutId = session.metadata?.checkout_id;
    if (!checkoutId) return Response.json({ received: true });
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
    console.error("Stripe webhook failed", event.id, error);
    return new Response("Please retry", { status: 500 });
  }
}
