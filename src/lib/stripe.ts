import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";
export function getStripe() {
  if (!env.stripeSecretKey)
    throw new Error("Payments are not configured yet. Please try again later.");
  return new Stripe(env.stripeSecretKey);
}
