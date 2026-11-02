import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin";
import { env } from "@/lib/env";
import { getStripeConnection, stripeIsLive, webhookUrl } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectStripe, repairWebhook } from "./actions";

export const metadata = { title: "Payments" };

const ERRORS: Record<string, string> = {
  cancelled: "Stripe sign-in was cancelled. Nothing was changed.",
  state: "The Stripe sign-in expired. Please click Connect with Stripe again.",
  mode: "That Stripe account is in the wrong mode for this site (test vs live).",
  setup:
    "Stripe Connect isn’t set up on the server yet (platform keys missing).",
  stripe: "Stripe couldn’t complete the connection. Please try again.",
};

const box = "rounded border border-black/10 bg-white p-6";
const button =
  "bg-brand hover:bg-brand-dark inline-block rounded px-5 py-2.5 text-sm font-bold text-white";

export default async function Payments({
  searchParams,
}: PageProps<"/admin/payments">) {
  await requireAdminPage();
  const params = await searchParams;
  const error = ERRORS[String(params.error ?? "")];
  const db = createAdminClient();
  const ready = Boolean(db && env.stripeSecretKey && env.stripeConnectClientId);
  const connection = db && ready ? await getStripeConnection(db) : null;
  const webhookOk =
    connection?.webhook_secret && connection.webhook_url === webhookUrl();
  const live = stripeIsLive();
  const checkoutOn = process.env.SHOP_CHECKOUT_ENABLED === "true";

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Card payments go straight into the shop’s own Stripe account."
      />
      {error && (
        <p role="alert" className="text-coral mb-6 font-semibold">
          {error}
        </p>
      )}
      {params.connected && connection && (
        <p role="status" className="mb-6 font-semibold text-green-700">
          Stripe is connected.
        </p>
      )}

      <section className={box}>
        <h2 className="text-ink mb-4 text-lg font-black">
          Stripe{" "}
          <span
            className={`ml-2 rounded px-2 py-0.5 align-middle text-xs font-bold uppercase ${
              live
                ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {live ? "Live" : "Test mode"}
          </span>
        </h2>

        {!ready ? (
          <p>
            Stripe Connect isn’t set up on the server yet. The developer needs
            to add <code>STRIPE_SECRET_KEY</code> and{" "}
            <code>STRIPE_CONNECT_CLIENT_ID</code> (the platform account) in
            Vercel.
          </p>
        ) : connection ? (
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted">Account</dt>
              <dd className="font-semibold">
                {connection.account_name || "Stripe account"}{" "}
                <span className="text-muted font-normal">
                  ({connection.account_id})
                </span>
              </dd>
              <dt className="text-muted">Connected</dt>
              <dd>
                {new Date(connection.connected_at).toLocaleString("en-MT", {
                  timeZone: "Europe/Malta",
                })}
              </dd>
              <dt className="text-muted">Order webhook</dt>
              <dd>
                {webhookOk ? (
                  <span className="text-green-700">Active</span>
                ) : (
                  <span className="text-coral">Needs repair</span>
                )}
              </dd>
              <dt className="text-muted">Online checkout</dt>
              <dd>
                {checkoutOn
                  ? "Open to customers"
                  : "Switched off on the server (SHOP_CHECKOUT_ENABLED)"}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-3">
              {!webhookOk && (
                <ActionForm action={repairWebhook}>
                  <button type="submit" className={button}>
                    Repair webhook
                  </button>
                </ActionForm>
              )}
              {/* A plain link: the route redirects to Stripe. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/admin/payments/connect/"
                className="text-ink rounded border border-black/20 px-5 py-2.5 text-sm font-bold"
              >
                Switch account
              </a>
              <ActionForm action={disconnectStripe}>
                <button
                  type="submit"
                  className="text-coral rounded border border-current px-5 py-2.5 text-sm font-bold"
                >
                  Disconnect
                </button>
              </ActionForm>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p>
              Sign in to the shop’s Stripe account and allow Battery Factory to
              take payments. The site sets up the order webhook by itself; no
              keys to copy.
            </p>
            {/* A plain link: the route redirects to Stripe. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/admin/payments/connect/" className={button}>
              Connect with Stripe
            </a>
          </div>
        )}
      </section>
    </>
  );
}
