"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/admin";
import { env } from "@/lib/env";
import {
  ensureWebhook,
  forgetConnection,
  getPlatformStripe,
  getStripeConnection,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function disconnectStripe() {
  await assertAdmin();
  const db = createAdminClient();
  if (!db) return { error: "Payments are not configured." };
  const connection = await getStripeConnection(db);
  if (!connection) return;
  if (env.stripeConnectClientId)
    await getPlatformStripe()
      .oauth.deauthorize({
        client_id: env.stripeConnectClientId,
        stripe_user_id: connection.account_id,
      })
      .catch(() => null);
  await forgetConnection(db, connection.account_id);
  revalidatePath("/admin/payments/");
}

export async function repairWebhook() {
  await assertAdmin();
  const db = createAdminClient();
  const connection = db && (await getStripeConnection(db));
  if (!db || !connection) return { error: "Connect Stripe first." };
  try {
    await ensureWebhook(db, connection);
  } catch {
    return { error: "Stripe refused the webhook. Please try again." };
  }
  revalidatePath("/admin/payments/");
}
