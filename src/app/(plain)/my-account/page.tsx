import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { formatDay, formatPrice } from "@/lib/format";
import { codePageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export function generateMetadata() {
  return codePageMetadata("my-account", "My account", { noindex: true });
}

// Reads the session on every request, so skip instant-navigation validation.
export const instant = false;

const STATUS: Record<string, string> = {
  pending: "Pending payment",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

async function Account() {
  const user = await getCurrentUser();
  if (!user) return <LoginForm />;
  const db = await createClient();
  const { data: orders } = await db
    .from("orders")
    .select(
      "id,number,created_at,status,total_cents,items:order_items(quantity)",
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  const name = user.fullName || user.username || user.email;
  return (
    <div className="mt-12 space-y-8">
      <p>
        Hello <strong>{name}</strong> (not <strong>{name}</strong>?{" "}
        <button form="sign-out" className="text-brand hover:underline">
          Log out
        </button>
        )
      </p>
      <form id="sign-out" action={signOut} />
      {user.role === "admin" && (
        <p>
          <Link href="/admin/" className="shop-button">
            Go to the CMS
          </Link>
        </p>
      )}
      <section>
        <h2 className="mb-6 text-2xl font-black">Orders</h2>
        {orders?.length ? (
          <table className="border-line w-full border text-left text-[15px]">
            <thead className="bg-[#fafafa]">
              <tr className="border-line border-b">
                {["Order", "Date", "Status", "Total"].map((h) => (
                  <th key={h} className="px-4 py-3 font-black">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const count = o.items.reduce((n, i) => n + i.quantity, 0);
                return (
                  <tr key={o.id} className="border-line border-b">
                    <td className="text-brand px-4 py-3">#{o.number}</td>
                    <td className="px-4 py-3">
                      {formatDay(o.created_at.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3">
                      {STATUS[o.status] ?? o.status}
                    </td>
                    <td className="px-4 py-3">
                      {formatPrice(o.total_cents)} for {count}{" "}
                      {count === 1 ? "item" : "items"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>
            No order has been made yet.{" "}
            <Link
              href="/shop-batteries-and-accessories/"
              className="text-brand hover:underline"
            >
              Browse products
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Container className="pt-[60px] pb-[120px]">
      <h1 className="section-title">My account</h1>
      <Suspense>
        <Account />
      </Suspense>
    </Container>
  );
}
