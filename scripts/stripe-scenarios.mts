// Test helper for checkout failure paths against a local server using a
// Stripe TEST key. Each scenario prints what it did; check the database after.
//
//   node --env-file=.env --env-file=.env.local scripts/stripe-scenarios.mts <scenario> <productId> [base url]
//
//   start      start one checkout and print its session id
//   expire     start a checkout, then expire its Stripe session (Stripe sends
//              checkout.session.expired; the forwarder must be running)
//   race       start two checkouts at the same moment (last-item test);
//              pass a quantity so that only one of them fits the stock
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) throw new Error("Test keys only.");
const stripe = new Stripe(key);
const [scenario, productId, base = "http://localhost:3000", qty = "1"] =
  process.argv.slice(2);
const quantity = Number(qty);

async function start() {
  const res = await fetch(`${base}/api/checkout/`, {
    method: "POST",
    headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ productId, variantId: null, quantity, options: {} }],
    }),
  });
  const body = (await res.json()) as { url?: string; error?: string };
  const session = body.url?.match(/(cs_test_[A-Za-z0-9]+)/)?.[1];
  return { status: res.status, session, error: body.error };
}

if (scenario === "start") console.log(await start());
else if (scenario === "expire") {
  const result = await start();
  console.log("started", result);
  if (result.session) {
    const expired = await stripe.checkout.sessions.expire(result.session);
    console.log("expired session", expired.id, expired.status);
  }
} else if (scenario === "race") {
  console.log(await Promise.all([start(), start()]));
} else throw new Error(`Unknown scenario ${scenario}`);
