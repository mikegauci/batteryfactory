import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hasAdminCapability } from "@/lib/admin/capabilities";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { STATE_COOKIE } from "@/lib/stripe";

// Sends a full admin to Stripe to sign in and allow the site to take
// payments into their account (Stripe Connect OAuth).
export async function GET(request: Request) {
  const back = new URL("/admin/payments/", request.url);
  const user = await getCurrentUser();
  if (!user || !hasAdminCapability(user))
    return NextResponse.redirect(new URL("/admin/?denied=1", request.url));
  if (!env.stripeSecretKey || !env.stripeConnectClientId) {
    back.searchParams.set("error", "setup");
    return NextResponse.redirect(back);
  }
  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://connect.stripe.com/oauth/authorize");
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: env.stripeConnectClientId,
    scope: "read_write",
    redirect_uri: `${env.siteUrl}/admin/payments/callback/`,
    state,
    "stripe_user[email]": user.email,
  }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/admin/payments/",
    maxAge: 600,
  });
  return response;
}
