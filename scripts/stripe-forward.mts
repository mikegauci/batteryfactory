// Local stand-in for `stripe listen`: polls Stripe (TEST mode only) for new
// checkout events and posts them, signed, to the local webhook.
//
//   pnpm stripe:forward            (default target http://localhost:3000)
//   pnpm stripe:forward http://localhost:3100
//
// Needs STRIPE_SECRET_KEY=sk_test_... and STRIPE_WEBHOOK_SECRET in .env.local.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
if (!key.startsWith("sk_test_")) {
  console.error("Refusing to run: STRIPE_SECRET_KEY is not a test key.");
  process.exit(1);
}
if (!secret) {
  console.error("Set STRIPE_WEBHOOK_SECRET in .env.local first.");
  process.exit(1);
}
const target = `${process.argv[2] ?? "http://localhost:3000"}/api/stripe/webhook/`;
const stripe = new Stripe(key);
const seen = new Set<string>();
let since = Math.floor(Date.now() / 1000) - 5;

console.log(`Forwarding Stripe test events to ${target}`);
for (;;) {
  const events = await stripe.events.list({
    created: { gte: since },
    types: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ],
    limit: 100,
  });
  for (const event of [...events.data].reverse()) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    since = Math.max(since, event.created - 5);
    const payload = JSON.stringify(event);
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripe.webhooks.generateTestHeaderString({
          payload,
          secret,
        }),
      },
      body: payload,
    }).catch((e: Error) => ({ status: `error ${e.message}` }));
    console.log(`${event.type} ${event.id} -> ${res.status}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
