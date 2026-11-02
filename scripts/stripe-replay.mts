// Test helper: re-delivers one Stripe TEST event to the local webhook twice
// (duplicate delivery) and once with a broken signature.
//
//   node --env-file=.env --env-file=.env.local scripts/stripe-replay.mts <evt_id> [base url]
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) throw new Error("Test keys only.");
const stripe = new Stripe(key);
const [id, base = "http://localhost:3000"] = process.argv.slice(2);
const target = `${base}/api/stripe/webhook/`;
const payload = JSON.stringify(await stripe.events.retrieve(id));
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
});
for (const [label, header] of [
  ["duplicate", signature],
  ["duplicate again", signature],
  ["bad signature", signature.replace(/v1=./, "v1=0")],
]) {
  const res = await fetch(target, {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
  console.log(`${label}: HTTP ${res.status}`);
}
