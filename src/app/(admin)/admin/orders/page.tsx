import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PurgeTestOrders } from "@/components/admin/purge-test-orders";
import { formatPrice, formatPostDate } from "@/lib/format";
import { Constants, type Enums } from "@/lib/supabase/database.types";
export const metadata = { title: "Orders" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    page?: string;
    q?: string;
    test?: string;
  }>;
}) {
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  // Stripe test-mode orders are hidden unless asked for.
  const test = filters.test === "1";
  const db = await createClient();
  let query = db
    .from("orders")
    .select("id,number,email,status,total_cents,created_at,livemode", {
      count: "exact",
    })
    .eq("livemode", !test)
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (
    Constants.public.Enums.order_status.includes(
      filters.status as Enums<"order_status">,
    )
  )
    query = query.eq("status", filters.status as Enums<"order_status">);
  if (filters.q) query = query.ilike("email", `%${filters.q.slice(0, 200)}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  const href = (n: number) =>
    `/admin/orders/?${new URLSearchParams({ page: String(n), ...(filters.status ? { status: filters.status } : {}), ...(filters.q ? { q: filters.q } : {}), ...(test ? { test: "1" } : {}) })}`;
  return (
    <>
      <AdminPageHeader
        title={test ? "Test orders" : "Orders"}
        description={
          test
            ? "Orders paid in Stripe test mode. They never appear with real orders."
            : undefined
        }
        actions={
          <Link
            href={test ? "/admin/orders/" : "/admin/orders/?test=1"}
            className="text-sm hover:underline"
          >
            {test ? "← Real orders" : "Test orders"}
          </Link>
        }
      />
      {test && <PurgeTestOrders />}
      <form className="mb-5 flex flex-wrap gap-3">
        <input
          name="q"
          placeholder="Search email"
          defaultValue={filters.q}
          className="rounded border border-black/20 bg-white p-2"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="rounded bg-white p-2"
        >
          <option value="">All statuses</option>
          {Constants.public.Enums.order_status.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {test && <input type="hidden" name="test" value="1" />}
        <button className="shop-button">Filter</button>
      </form>
      <div className="overflow-auto rounded bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Order", "Customer", "Date", "Status", "Total"].map((v) => (
                <th key={v} className="p-3">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((o) => (
              <tr key={o.id} className="border-t border-black/10">
                <td className="p-3">
                  <Link
                    className="font-bold underline"
                    href={`/admin/orders/${o.id}/`}
                  >
                    #{o.number}
                  </Link>
                </td>
                <td>{o.email}</td>
                <td>{formatPostDate(o.created_at)}</td>
                <td>{o.status}</td>
                <td>{formatPrice(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="mt-5 flex gap-6">
        {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
        {page * 50 < (count ?? 0) && <Link href={href(page + 1)}>Next →</Link>}
      </nav>
    </>
  );
}
