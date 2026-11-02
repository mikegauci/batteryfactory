import { ActionForm } from "@/components/admin/action-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/admin";
import {
  canReceiveWebhooks,
  getStripeAccount,
  maskKey,
  webhookIsActive,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { fixWebhook, removeKey, saveKey } from "./actions";

export const metadata = { title: "Payments" };

const box = "rounded border border-black/10 bg-white p-6";
const button =
  "bg-brand hover:bg-brand-dark rounded px-5 py-2.5 text-sm font-bold text-white";

export default async function Payments() {
  await requireAdminPage();
  const db = createAdminClient();
  const account = db ? await getStripeAccount(db) : null;
  const webhookOk = account ? await webhookIsActive(account) : false;
  const checkoutOn = process.env.SHOP_CHECKOUT_ENABLED === "true";

  return (
    <>
      <AdminPageHeader
        title="Payments"
        description="Card payments go straight into the shop’s Stripe account."
      />

      {account && (
        <section className={`${box} mb-6`}>
          <h2 className="text-ink mb-4 text-lg font-black">
            Stripe{" "}
            <span
              className={`ml-2 rounded px-2 py-0.5 align-middle text-xs font-bold uppercase ${
                account.livemode
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {account.livemode ? "Live" : "Test mode"}
            </span>
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            {account.account_name && (
              <>
                <dt className="text-muted">Account</dt>
                <dd className="font-semibold">{account.account_name}</dd>
              </>
            )}
            <dt className="text-muted">Secret key</dt>
            <dd>
              <code>{maskKey(account.secret_key)}</code>
            </dd>
            <dt className="text-muted">Order webhook</dt>
            <dd>
              {webhookOk ? (
                <span className="text-green-700">Active</span>
              ) : canReceiveWebhooks() ? (
                <span className="text-coral">Needs repair</span>
              ) : (
                "Local site: run pnpm stripe:forward"
              )}
            </dd>
            <dt className="text-muted">Online checkout</dt>
            <dd>
              {checkoutOn
                ? "Open to customers"
                : "Switched off on the server (SHOP_CHECKOUT_ENABLED)"}
            </dd>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            {!webhookOk && canReceiveWebhooks() && (
              <ActionForm action={fixWebhook}>
                <button type="submit" className={button}>
                  Repair webhook
                </button>
              </ActionForm>
            )}
            <ActionForm action={removeKey}>
              <button
                type="submit"
                className="text-coral rounded border border-current px-5 py-2.5 text-sm font-bold"
              >
                Remove key
              </button>
            </ActionForm>
          </div>
        </section>
      )}

      <section className={box}>
        <h2 className="text-ink mb-2 text-lg font-black">
          {account ? "Replace the secret key" : "Connect Stripe"}
        </h2>
        <p className="mb-4 text-sm">
          In Stripe, open <strong>Developers → API keys</strong>, reveal the{" "}
          <strong>Secret key</strong> (starts with <code>sk_live_</code>) and
          paste it here. The site checks it and sets up the order webhook by
          itself. Use a <code>sk_test_</code> key to try test payments first.
        </p>
        <ActionForm action={saveKey} className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="secret_key">
            Stripe secret key
          </label>
          <input
            id="secret_key"
            name="secret_key"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="sk_live_…"
            className="min-w-0 flex-1 rounded border border-black/20 bg-white p-2 font-mono text-sm"
          />
          <button type="submit" className={button}>
            Save key
          </button>
        </ActionForm>
      </section>
    </>
  );
}
