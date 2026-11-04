import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

// The shop's Stripe secret key is pasted in Admin → Payments and stored in
// `stripe_account` (service role only). Saving it creates the order webhook
// on the shop's account and stores the webhook's signing secret.

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type StripeAccount = Tables<"stripe_account">;

export const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] =
  [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
  ];

const KEY = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;
const NOT_READY = "Payments are not configured yet. Please try again later.";

// Test keys (sk_test_) create test-mode sessions; their orders are marked
// livemode=false, hidden from the admin by default and purgeable.
export const keyIsLive = (key: string) => /^(sk|rk)_live_/.test(key);

export const maskKey = (key: string) =>
  `${key.slice(0, key.indexOf("_", 3) + 1)}••••${key.slice(-4)}`;

export async function getStripeAccount(
  db: Admin,
): Promise<StripeAccount | null> {
  const { data, error } = await db
    .from("stripe_account")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The shop's Stripe client and whether it's live. Throws until a key is saved.
export async function getStripe(db = createAdminClient()) {
  const account = db && (await getStripeAccount(db));
  if (!account) throw new Error(NOT_READY);
  return {
    stripe: new Stripe(account.secret_key),
    live: account.livemode,
    account,
  };
}

export function webhookUrl() {
  return `${env.siteUrl}/api/stripe/webhook/`;
}

// Stripe only sends webhooks to public URLs; locally use `pnpm stripe:forward`.
export const canReceiveWebhooks = () =>
  !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.siteUrl);

async function createWebhook(stripe: Stripe) {
  if (!canReceiveWebhooks()) return null;
  return stripe.webhookEndpoints.create({
    // Required when the key belongs to a connected account (keys linked by
    // the WooCommerce Stripe plugin); events then match this SDK's version.
    api_version: Stripe.API_VERSION,
    url: webhookUrl(),
    enabled_events: WEBHOOK_EVENTS,
    description: "Battery Factory shop orders",
  });
}

function stripeMessage(error: unknown) {
  const e = error as { type?: string; message?: string };
  if (e?.type === "StripeAuthenticationError")
    return "Stripe didn’t accept this key. Copy the secret key again from Stripe → Developers → API keys.";
  if (e?.type === "StripePermissionError")
    return "This restricted key can’t manage webhooks or Checkout. Use the secret key, or give the restricted key write access to Checkout Sessions and Webhook Endpoints.";
  return e?.message ?? "Stripe couldn’t be reached. Please try again.";
}

// Validates the key against Stripe, creates the webhook with it and saves
// both. The old webhook is removed only once the new one exists.
export async function saveStripeKey(
  db: Admin,
  key: string,
  userId: string,
): Promise<{ error: string } | void> {
  key = key.trim();
  if (!KEY.test(key))
    return {
      error:
        "Paste the secret key that starts with sk_live_ (or sk_test_ for testing). The publishable key (pk_) won’t work here.",
    };
  const stripe = new Stripe(key);
  let accountId = "";
  let name = "";
  try {
    const account = await stripe.accounts.retrieveCurrent();
    accountId = account.id;
    name =
      account.settings?.dashboard?.display_name ||
      account.business_profile?.name ||
      account.email ||
      "";
  } catch (error) {
    // Restricted keys may not read the account; the webhook call below
    // still proves the key works.
    if ((error as { type?: string }).type !== "StripePermissionError")
      return { error: stripeMessage(error) };
  }

  let endpoint: Stripe.WebhookEndpoint | null;
  try {
    endpoint = await createWebhook(stripe);
  } catch (error) {
    return { error: stripeMessage(error) };
  }
  const previous = await getStripeAccount(db);
  const { error } = await db.from("stripe_account").upsert({
    id: true,
    secret_key: key,
    livemode: keyIsLive(key),
    account_id: accountId,
    account_name: name,
    webhook_endpoint_id: endpoint?.id ?? null,
    webhook_secret: endpoint?.secret ?? null,
    webhook_url: endpoint ? webhookUrl() : null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (endpoint)
      await stripe.webhookEndpoints.del(endpoint.id).catch(() => null);
    return { error: "Couldn’t save the key. Please try again." };
  }
  if (previous?.webhook_endpoint_id)
    await new Stripe(previous.secret_key).webhookEndpoints
      .del(previous.webhook_endpoint_id)
      .catch(() => null);
}

// Recreates the webhook when it's missing, disabled or points at an old
// site URL (e.g. after moving to batteryfactory.mt).
export async function repairWebhook(
  db: Admin,
): Promise<{ error: string } | void> {
  const account = await getStripeAccount(db);
  if (!account) return { error: "Save a Stripe key first." };
  if (!canReceiveWebhooks())
    return {
      error: "Webhooks can’t reach localhost. Use pnpm stripe:forward.",
    };
  const stripe = new Stripe(account.secret_key);
  try {
    const endpoint = await createWebhook(stripe);
    if (!endpoint) return;
    const { error } = await db
      .from("stripe_account")
      .update({
        webhook_endpoint_id: endpoint.id,
        webhook_secret: endpoint.secret ?? null,
        webhook_url: webhookUrl(),
      })
      .eq("id", true);
    if (error) throw error;
  } catch (error) {
    return { error: stripeMessage(error) };
  }
  if (account.webhook_endpoint_id)
    await stripe.webhookEndpoints
      .del(account.webhook_endpoint_id)
      .catch(() => null);
}

export async function webhookIsActive(account: StripeAccount) {
  if (
    !account.webhook_endpoint_id ||
    !account.webhook_secret ||
    account.webhook_url !== webhookUrl()
  )
    return false;
  const endpoint = await new Stripe(account.secret_key).webhookEndpoints
    .retrieve(account.webhook_endpoint_id)
    .catch(() => null);
  return endpoint?.status === "enabled";
}

export async function removeStripeKey(db: Admin) {
  const account = await getStripeAccount(db);
  if (!account) return;
  if (account.webhook_endpoint_id)
    await new Stripe(account.secret_key).webhookEndpoints
      .del(account.webhook_endpoint_id)
      .catch(() => null);
  const { error } = await db.from("stripe_account").delete().eq("id", true);
  if (error) throw error;
}
