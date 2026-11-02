"use client";
import { useState } from "react";
import { useCart, CartLines } from "./cart";
import { formatPrice } from "@/lib/format";
export function CartPage({ checkout = false }: { checkout?: boolean }) {
  const { items } = useCart();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  async function pay() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
            options: i.options,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(result.url);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Checkout failed. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-[1170px] px-5 py-16">
      <h1 className="text-ink mb-10 text-3xl font-black">
        {checkout ? "Checkout" : "Cart"}
      </h1>
      <div className="desk:grid-cols-[1fr_420px] grid gap-12">
        <CartLines />
        {items.length > 0 && (
          <section className="border border-black/15 p-6">
            <h2 className="mb-6 text-2xl font-bold">
              {checkout ? "Your order" : "Cart totals"}
            </h2>
            <p className="flex justify-between border-b border-black/10 py-4">
              <span>Subtotal</span>
              {formatPrice(subtotal)}
            </p>
            <p className="border-b border-black/10 py-4">
              Malta & Gozo - Free Delivery
            </p>
            <p className="flex justify-between py-4 font-bold">
              <span>Total</span>
              {formatPrice(subtotal)}
            </p>
            <p className="mb-6 text-sm">
              Includes 18% VAT. Delivery only to Malta & Gozo.
            </p>
            {checkout && (
              <p className="mb-5 text-sm">
                Enter your billing and delivery details and pay securely with
                Stripe.
              </p>
            )}
            <button
              onClick={pay}
              disabled={busy}
              className="shop-button w-full"
            >
              {busy
                ? "Opening checkout…"
                : checkout
                  ? "Proceed to payment"
                  : "Proceed to checkout"}
            </button>
            <p role="alert" className="text-coral mt-4">
              {error}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
