import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

// Payments use Stripe Connect: the platform key (env) acts on the shop's own
// Stripe account, which the admin links from Admin → Payments by signing in
// to Stripe. Orders are direct charges on that account.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type StripeConnection = Tables<"stripe_connection">;

export const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] =
  [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
    "account.application.deauthorized",
  ];

// Ties the Stripe sign-in redirect to the browser that started it.
export const STATE_COOKIE = "bf_stripe_state";

const NOT_READY = "Payments are not configured yet. Please try again later.";

export function getPlatformStripe() {
  if (!env.stripeSecretKey) throw new Error(NOT_READY);
  return new Stripe(env.stripeSecretKey);
}

// Test platform keys (sk_test_) connect and charge in test mode.
export function stripeIsLive() {
  return Boolean(env.stripeSecretKey?.startsWith("sk_live_"));
}

export async function getStripeConnection(
  db: Admin,
): Promise<StripeConnection | null> {
  const { data, error } = await db
    .from("stripe_connection")
    .select("*")
    .eq("livemode", stripeIsLive())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// A Stripe client that acts on the connected shop account.
export async function getStripe(db = createAdminClient()) {
  if (!db || !env.stripeSecretKey) throw new Error(NOT_READY);
  const connection = await getStripeConnection(db);
  if (!connection) throw new Error(NOT_READY);
  return new Stripe(env.stripeSecretKey, {
    stripeAccount: connection.account_id,
  });
}

export function webhookUrl() {
  return `${env.siteUrl}/api/stripe/webhook/`;
}

// One Connect webhook on the platform receives the shop account's events.
// Recreated when the site URL changes (e.g. at go-live on batteryfactory.mt).
export async function ensureWebhook(db: Admin, connection: StripeConnection) {
  const stripe = getPlatformStripe();
  const url = webhookUrl();
  if (
    connection.webhook_endpoint_id &&
    connection.webhook_secret &&
    connection.webhook_url === url
  ) {
    const existing = await stripe.webhookEndpoints
      .retrieve(connection.webhook_endpoint_id)
      .catch(() => null);
    if (existing?.status === "enabled") return;
  }
  if (connection.webhook_endpoint_id)
    await stripe.webhookEndpoints
      .del(connection.webhook_endpoint_id)
      .catch(() => null);
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    connect: true,
    enabled_events: WEBHOOK_EVENTS,
    description: "Battery Factory shop orders",
  });
  const { error } = await db
    .from("stripe_connection")
    .update({
      webhook_endpoint_id: endpoint.id,
      webhook_secret: endpoint.secret ?? null,
      webhook_url: url,
    })
    .eq("livemode", connection.livemode);
  if (error) throw error;
}

// Removes the link locally and its webhook. Stripe's own deauthorisation is
// done by the caller (or already happened when the shop disconnected us).
export async function forgetConnection(db: Admin, accountId: string) {
  const { data } = await db
    .from("stripe_connection")
    .select("webhook_endpoint_id")
    .eq("account_id", accountId)
    .eq("livemode", stripeIsLive())
    .maybeSingle();
  if (data?.webhook_endpoint_id)
    await getPlatformStripe()
      .webhookEndpoints.del(data.webhook_endpoint_id)
      .catch(() => null);
  const { error } = await db
    .from("stripe_connection")
    .delete()
    .eq("account_id", accountId)
    .eq("livemode", stripeIsLive());
  if (error) throw error;
}
