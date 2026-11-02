import {
  ADMIN_CAPABILITIES,
  type AdminCapability,
} from "@/lib/admin/capabilities";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  salesSummary,
  type AnalyticsOrder,
} from "@/lib/admin/analytics";
import { formatDay, formatPrice, maltaToday } from "@/lib/format";

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const me = await getCurrentUser();
  if (me?.role === "admin" && me.adminCapabilities !== null)
    return (
      <>
        <AdminPageHeader
          title="Dashboard"
          description="Choose a section to manage."
        />
        {params.denied === "1" && (
          <p
            role="status"
            className="mb-5 rounded-lg bg-amber-50 p-3 text-amber-900"
          >
            Your account does not have access to that section.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {me.adminCapabilities
            .filter((cap): cap is AdminCapability =>
              Object.hasOwn(ADMIN_CAPABILITIES, cap),
            )
            .map((cap) => (
              <Link
                className="hover:border-brand rounded-xl border border-black/10 bg-white p-6 font-bold"
                key={cap}
                href={`/admin/${cap}/`}
              >
                {ADMIN_CAPABILITIES[cap]} →
              </Link>
            ))}
        </div>
        {!me.adminCapabilities.length && (
          <p>
            No CMS sections have been assigned to your account. Contact a full
            administrator.
          </p>
        )}
      </>
    );
  const days = params.days === "7" ? 7 : params.days === "90" ? 90 : 30;
  const today = maltaToday();
  const user = await getCurrentUser();
  const db = await createClient();
  // Fetch every batch: historical WooCommerce orders can exceed the API row limit.
  const orders: AnalyticsOrder[] = [];
  let salesError = false;
  const since = addDays(today, -days * 2);
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from("orders")
      .select("id,created_at,status,total_cents,currency")
      .eq("livemode", true)
      .gte("created_at", `${since}T00:00:00Z`)
      .order("created_at")
      .order("id")
      .range(offset, offset + 999);
    if (result.error) {
      salesError = true;
      break;
    }
    orders.push(...result.data);
    if (result.data.length < 1000) break;
  }
  const sales = salesSummary(orders, today, days);
  const max = Math.max(1, ...sales.series.map((p) => p.revenue));
  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.username ?? user?.email}.`}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Shop analytics</h2>
          <Link href="/admin/tools/?view=reports" className="text-sm underline">
            Detailed sales reports →
          </Link>
        </div>
        <nav aria-label="Sales period" className="flex gap-2">
          {[7, 30, 90].map((n) => (
            <Link
              key={n}
              href={`/admin/?days=${n}`}
              aria-current={days === n ? "page" : undefined}
              className={`rounded px-3 py-2 text-sm ${days === n ? "bg-ink text-white" : "bg-white"}`}
            >
              Last {n} days
            </Link>
          ))}
        </nav>
      </div>
      {salesError ? (
        <p role="alert" className="text-coral rounded bg-white p-5">
          Shop analytics could not be loaded. Try refreshing.
        </p>
      ) : (
        <>
          <p className="text-muted mb-4 text-sm">
            {formatDay(sales.start)} – {formatDay(today)} · Europe/Malta · EUR.
            Revenue includes tax and shipping on processing/completed orders;
            refunded and cancelled orders are excluded. Orders are grouped by
            order date.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Revenue", value: formatPrice(sales.revenue) },
              { label: "Paid orders", value: sales.paid },
              {
                label: "Average order value",
                value: formatPrice(sales.average),
              },
              { label: "All orders", value: sales.total },
            ].map((stat) => (
              <Link
                key={stat.label}
                href="/admin/orders/"
                className="rounded-lg bg-white p-5 shadow-sm"
              >
                <p className="text-muted text-sm">{stat.label}</p>
                <p className="text-ink mt-1 text-3xl font-black">
                  {stat.value}
                </p>
              </Link>
            ))}
          </div>
          <section
            className="my-6 rounded-lg bg-white p-5 shadow-sm"
            aria-label="Daily revenue"
          >
            <h3 className="font-bold">Daily sales</h3>
            <p className="text-muted mt-1 text-sm">
              Previous {days} days: {formatPrice(sales.previousRevenue)}
              {sales.previousRevenue > 0
                ? ` · ${((sales.revenue / sales.previousRevenue - 1) * 100).toFixed(1)}% change`
                : ""}{" "}
              · {sales.pending} awaiting payment
            </p>
            <div className="mt-5 overflow-x-auto">
              <div className="flex h-44 min-w-[500px] items-end gap-1">
                {sales.series.map((point) => (
                  <div
                    key={point.day}
                    className="group relative flex h-full min-w-1 flex-1 items-end"
                    title={`${point.day}: ${formatPrice(point.revenue)}, ${point.orders} paid orders`}
                  >
                    <div
                      className="bg-brand w-full rounded-t"
                      style={{
                        height: `${Math.max(1, (point.revenue / max) * 100)}%`,
                      }}
                    />
                    <span className="sr-only">
                      {point.day}: {formatPrice(point.revenue)}, {point.orders}{" "}
                      paid orders
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-muted mt-2 flex justify-between text-xs">
              <span>{sales.start}</span>
              <span>{today}</span>
            </div>
            {sales.paid === 0 && (
              <p className="text-muted mt-4 text-sm">
                No paid orders in this period.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
