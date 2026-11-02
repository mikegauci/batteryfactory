import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getStripe } from "@/lib/stripe";
import { ClearPaidCart } from "@/components/shop/clear-paid-cart";
export const metadata = { title: "Order received", robots: { index: false } };
async function Receipt({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  await connection();
  let paid = false;
  try {
    if (session_id?.startsWith("cs_")) {
      const s = await getStripe().checkout.sessions.retrieve(session_id);
      paid = s.payment_status === "paid" && !!s.metadata?.checkout_id;
    }
  } catch {}
  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <h1 className="mb-6 text-3xl font-black">
        {paid ? "Thank you for your order" : "Payment confirmation"}
      </h1>
      <p>
        {paid
          ? "Your payment was received. Your order confirmation will arrive by email shortly."
          : "We haven’t confirmed your payment yet. If you paid, please wait for your order email before trying again."}
      </p>
      {paid && <ClearPaidCart />}
      <Link href="/shop/" className="shop-button mt-8">
        Continue shopping
      </Link>
    </div>
  );
}
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <Suspense>
      <Receipt searchParams={searchParams} />
    </Suspense>
  );
}
