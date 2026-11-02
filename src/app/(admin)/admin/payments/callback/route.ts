import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasAdminCapability } from "@/lib/admin/capabilities";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  STATE_COOKIE,
  ensureWebhook,
  forgetConnection,
  getPlatformStripe,
  getStripeConnection,
  stripeIsLive,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function sameState(a: string | undefined, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Stripe sends the admin back here after they sign in and allow access.
// Saves the shop's account id and creates the webhook for its orders.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const back = new URL("/admin/payments/", request.url);
  const done = (result: Record<string, string>) => {
    for (const [k, v] of Object.entries(result)) back.searchParams.set(k, v);
    const response = NextResponse.redirect(back);
    response.cookies.delete({ name: STATE_COOKIE, path: "/admin/payments/" });
    return response;
  };

  const user = await getCurrentUser();
  if (!user || !hasAdminCapability(user))
    return NextResponse.redirect(new URL("/admin/?denied=1", request.url));
  if (
    !sameState(
      request.cookies.get(STATE_COOKIE)?.value,
      searchParams.get("state"),
    )
  )
    return done({ error: "state" });
  if (searchParams.get("error"))
    return done({
      error:
        searchParams.get("error") === "access_denied" ? "cancelled" : "stripe",
    });
  const code = searchParams.get("code");
  const db = createAdminClient();
  if (!code || !db || !env.stripeSecretKey) return done({ error: "setup" });

  try {
    const stripe = getPlatformStripe();
    const token = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });
    const accountId = token.stripe_user_id;
    if (!accountId || token.livemode !== stripeIsLive())
      return done({ error: "mode" });
    const account = await stripe.accounts.retrieve(accountId);
    const name =
      account.settings?.dashboard?.display_name ||
      account.business_profile?.name ||
      account.email ||
      "";

    // Connecting a different account replaces the old link.
    const previous = await getStripeConnection(db);
    if (previous && previous.account_id !== accountId) {
      if (env.stripeConnectClientId)
        await stripe.oauth
          .deauthorize({
            client_id: env.stripeConnectClientId,
            stripe_user_id: previous.account_id,
          })
          .catch(() => null);
      await forgetConnection(db, previous.account_id);
    }
    const { data: connection, error } = await db
      .from("stripe_connection")
      .upsert({
        livemode: stripeIsLive(),
        account_id: accountId,
        account_name: name,
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    await ensureWebhook(db, connection);
    return done({ connected: "1" });
  } catch (error) {
    console.error("Stripe connect failed", error);
    return done({ error: "stripe" });
  }
}
