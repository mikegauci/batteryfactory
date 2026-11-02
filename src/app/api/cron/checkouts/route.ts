import { timingSafeEqual } from "node:crypto";
import { reconcileCheckouts } from "@/lib/checkout";

// Vercel Cron (see vercel.json) calls this with "Authorization: Bearer
// <CRON_SECRET>". Checkout requests also reconcile, so this is a backstop
// for quiet periods.
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
  return Response.json(await reconcileCheckouts(50));
}
