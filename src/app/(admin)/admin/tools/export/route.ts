import { assertAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  await assertAdmin();
  const db = await createClient();
  const params = new URL(request.url).searchParams;
  const from = params.get("from"),
    to = params.get("to");
  for (const day of [from, to])
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day))
      return new Response("Invalid date", { status: 400 });
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let q = db
      .from("orders")
      .select("number,created_at,status,total_cents,currency")
      .eq("livemode", true)
      .in("status", ["processing", "completed"])
      .eq("currency", "EUR")
      .order("id")
      .range(offset, offset + 999);
    if (from) q = q.gte("created_at", from + "T00:00:00Z");
    if (to)
      q = q.lt(
        "created_at",
        new Date(Date.parse(to + "T00:00:00Z") + 86400000).toISOString(),
      );
    const { data, error } = await q;
    if (error) return new Response("Could not export report", { status: 500 });
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const csv = [
    "Order,Date UTC,Status,Currency,Total EUR",
    ...rows.map((r) =>
      [
        r.number,
        r.created_at,
        r.status,
        r.currency,
        (r.total_cents / 100).toFixed(2),
      ].join(","),
    ),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="batteryfactory-sales.csv"',
      "Cache-Control": "no-store",
    },
  });
}
