import Stripe from "stripe";
import { revalidateTag } from "next/cache";
import { fulfillSession, sendOrderEmails } from "@/lib/checkout";
import { env } from "@/lib/env";
import { getStripeAccount } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.expired",
]);

// Signed with the secret stored when the admin saved the Stripe key
// (STRIPE_WEBHOOK_SECRET is the fallback for the local forwarder).
// Stripe retries any non-2xx for up to three days, so a failure to record a
// paid order returns 500. Email failures don't: the reconciler retries them.
export async function POST(request: Request) {
  const db = createAdminClient();
  const account = db && (await getStripeAccount(db).catch(() => null));
  if (!db || !account)
    return new Response("Webhook unavailable", { status: 503 });
  const secrets = [account.webhook_secret, env.stripeWebhookSecret].filter(
    (s): s is string => Boolean(s),
  );

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = Stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {}
  }
  if (!event) return new Response("Invalid signature", { status: 400 });

  // Test events never touch a live key, and the other way round.
  if (event.livemode !== account.livemode || !HANDLED.has(event.type))
    return Response.json({ received: true });

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
