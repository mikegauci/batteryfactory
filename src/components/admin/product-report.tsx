import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
export async function ProductReport({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const db = await createClient();
  const totals = new Map<string, { quantity: number; revenue: number }>();
  for (let offset = 0; ; offset += 1000) {
    let query = db
      .from("order_items")
      .select(
        "name,quantity,total_cents,orders!inner(created_at,status,currency)",
      )
      .in("orders.status", ["processing", "completed"])
      .eq("orders.currency", "EUR")
      .eq("orders.livemode", true)
      .order("id")
      .range(offset, offset + 999);
    if (from) query = query.gte("orders.created_at", from + "T00:00:00Z");
    if (to)
      query = query.lt(
        "orders.created_at",
        new Date(Date.parse(to + "T00:00:00Z") + 86400000).toISOString(),
      );
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data) {
      const value = totals.get(row.name) || { quantity: 0, revenue: 0 };
      value.quantity += row.quantity;
      value.revenue += row.total_cents;
      totals.set(row.name, value);
    }
    if (data.length < 1000) break;
  }
  return (
    <>
      <h2 className="mt-8 mb-4 text-xl font-bold">Top products</h2>
      <p className="text-muted mb-3 text-sm">
        Item revenue excludes order-level shipping and discounts.
      </p>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Product</th>
            <th>Units</th>
            <th>Item revenue</th>
          </tr>
        </thead>
        <tbody>
          {[...totals]
            .sort(([, a], [, b]) => b.revenue - a.revenue)
            .slice(0, 20)
            .map(([name, v]) => (
              <tr key={name}>
                <td className="py-2">{name}</td>
                <td>{v.quantity}</td>
                <td>{formatPrice(v.revenue)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </>
  );
}
