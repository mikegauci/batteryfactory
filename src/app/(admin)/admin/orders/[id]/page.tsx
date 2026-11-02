import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderForm } from "@/components/admin/order-form";
import { formatPrice, formatPostDate } from "@/lib/format";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const db = await createClient();
  const { data: o, error } = await db
    .from("orders")
    .select("*,items:order_items(*),notes:order_notes(*)")
    .eq("id", (await params).id)
    .maybeSingle();
  if (error) throw error;
  if (!o) notFound();
  return (
    <>
      <AdminPageHeader
        title={`Order #${o.number}${o.livemode ? "" : " (test)"}`}
        description={`${o.email} · ${formatPostDate(o.created_at)}`}
      />
      {!o.livemode && (
        <p className="mb-5 rounded bg-yellow-100 p-3 text-sm">
          Paid in Stripe test mode: no real money was taken. Test orders are
          hidden from the orders list and can be deleted there.
        </p>
      )}
      <section className="space-y-5 rounded bg-white p-5">
        {o.items.map((i) => (
          <div
            className="flex justify-between border-b border-black/10 pb-4"
            key={i.id}
          >
            <span>
              {i.quantity} × {i.name}{" "}
              <small>{Object.values(i.option_values ?? {}).join(" / ")}</small>
            </span>
            {formatPrice(i.total_cents)}
          </div>
        ))}
        <p>Subtotal: {formatPrice(o.subtotal_cents)}</p>
        <p>Discount: {formatPrice(o.discount_cents)}</p>
        <p>
          Shipping: {formatPrice(o.shipping_cents)} — {o.shipping_method}
        </p>
        <p className="font-bold">
          Total: {formatPrice(o.total_cents)} (VAT included:{" "}
          {formatPrice(o.vat_cents)})
        </p>
        <p>
          Paid with {o.payment_method} ·{" "}
          {o.paid_at ? formatPostDate(o.paid_at) : "Unpaid"}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            ["Billing", o.billing_address],
            ["Delivery", o.shipping_address],
          ].map(([label, a]) => (
            <div key={String(label)}>
              <h2 className="font-bold">{String(label)}</h2>
              <p className="whitespace-pre-line">
                {Object.entries(a ?? {})
                  .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
                  .join("\n")}
              </p>
            </div>
          ))}
        </div>
        {o.customer_note && <p>Customer note: {o.customer_note}</p>}
      </section>
      <OrderForm id={o.id} status={o.status} />
      <section className="mt-6 space-y-4">
        <h2 className="text-xl font-bold">Order notes</h2>
        {o.notes
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((n) => (
            <article key={n.id} className="rounded bg-white p-4">
              <p className="text-muted mb-2 text-xs">
                {formatPostDate(n.created_at)} ·{" "}
                {n.customer_visible ? "Customer" : "Internal"}
              </p>
              <p className="whitespace-pre-line">{n.body}</p>
            </article>
          ))}
      </section>
    </>
  );
}
