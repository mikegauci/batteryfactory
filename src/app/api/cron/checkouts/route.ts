import { timingSafeEqual } from "node:crypto";
import { reconcileCheckouts } from "@/lib/checkout";
import { createAdminClient } from "@/lib/supabase/admin";

// Vercel Cron (see vercel.json) calls this daily with "Authorization: Bearer
// <CRON_SECRET>". Checkout requests also reconcile, so this is a backstop
// for quiet periods. It also queries Supabase every day, so the free project
// is never paused for inactivity (Supabase pauses after 7 idle days).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  const db = createAdminClient();
  const ping = db
    ? await db.from("settings").select("key").limit(1)
    : { error: new Error("Supabase is not configured") };
  if (ping.error) console.error("Supabase keep-alive failed", ping.error);
  return Response.json({
    supabase: !ping.error,
    ...(await reconcileCheckouts(50)),
  });
}
