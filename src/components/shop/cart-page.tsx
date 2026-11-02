"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/shop-types";
import { cartKey, useCart } from "./cart";
import { Quantity } from "./product-detail";
import { WooNotice } from "./woo-notice";

export type Shipping = { freeFromCents: number | null; priceCents: number };

export function shippingCost(shipping: Shipping, subtotal: number) {
  return shipping.freeFromCents !== null && subtotal >= shipping.freeFromCents
    ? 0
    : shipping.priceCents;
}

export function lineDetails(i: CartItem) {
  return [
    ...Object.entries(i.options).map(([k, v]) => `${k}: ${v}`),
    ...(i.addons ?? []).map((a) => `${a.label} (+${formatPrice(a.price)})`),
  ];
}

// WooCommerce cart: line table with quantity steppers and "Update cart",
// then the "Cart totals" box.
export function CartPage() {
  const { items, setQuantity } = useCart();
  // Quantities are edited locally and saved with "Update cart", as on WooCommerce.
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [updated, setUpdated] = useState(false);
  const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const dirty = items.some(
    (i) => draft[cartKey(i)] !== undefined && draft[cartKey(i)] !== i.quantity,
  );

  if (!items.length)
    return (
      <>
        <WooNotice tone="info">Your cart is currently empty.</WooNotice>
        <Link href="/shop-batteries-and-accessories/" className="shop-button">
          Return to shop
        </Link>
      </>
    );

  const th = "px-3 py-4 text-left text-[15px] font-black";
  return (
    <>
      {updated && <WooNotice>Cart updated.</WooNotice>}
      <div className="border-line border">
        <table className="w-full text-[15px]">
          <thead className="bg-[#fafafa] max-md:hidden">
            <tr className="border-line border-b">
              <th className="w-20" />
              <th className="w-[150px]" />
              <th className={th}>Product</th>
              <th className={th}>Price</th>
              <th className={th}>Quantity</th>
              <th className={th}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const key = cartKey(i);
              return (
                <tr
                  key={key}
                  className="border-line border-b max-md:grid max-md:grid-cols-[auto_1fr] max-md:gap-2 max-md:p-4"
                >
                  <td className="px-3 py-6 text-center">
                    <button
                      type="button"
                      onClick={() => setQuantity(i, 0)}
                      aria-label={`Remove ${i.name} from cart`}
                      className="text-muted hover:text-coral grid size-5 place-items-center rounded-full border border-current text-xs"
                    >
                      ×
                    </button>
                  </td>
                  <td className="px-3 py-6">
                    {i.image && (
                      <Image
                        width={140}
                        height={140}
                        src={i.image}
                        alt=""
                        className="size-[70px] object-cover"
                      />
                    )}
                  </td>
                  <td className="px-3 py-6">
                    <Link href={`/product/${i.slug}/`} className="text-brand">
                      {i.name}
                    </Link>
                    {lineDetails(i).map((d) => (
                      <p key={d} className="text-muted text-sm">
                        {d}
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-6">{formatPrice(i.price)}</td>
                  <td className="px-3 py-6">
                    <Quantity
                      label={`${i.name} quantity`}
                      value={draft[key] ?? i.quantity}
                      onChange={(n) => {
                        setDraft({ ...draft, [key]: n });
                        setUpdated(false);
                      }}
                    />
                  </td>
                  <td className="px-3 py-6">
                    {formatPrice(i.price * i.quantity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex justify-end p-3">
          <button
            type="button"
            disabled={!dirty}
            className="shop-button disabled:opacity-50"
            onClick={() => {
              for (const i of items) {
                const n = draft[cartKey(i)];
                if (n !== undefined && n !== i.quantity) setQuantity(i, n);
              }
              setDraft({});
              setUpdated(true);
            }}
          >
            Update cart
          </button>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <section className="border-line w-full border md:w-[48%]">
          <h2 className="border-line border-b bg-[#fafafa] px-[30px] py-5 text-3xl font-black">
            Cart totals
          </h2>
          <div className="px-5 pt-5 pb-14">
            <dl className="text-[15px]">
              <div className="border-line grid grid-cols-[1fr_1.5fr] border-b px-4 py-4">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <div className="border-line grid grid-cols-[1fr_1.5fr] border-b px-4 py-4">
                <dt>Shipping</dt>
                <dd>Shipping costs are calculated during checkout.</dd>
              </div>
              <div className="border-line grid grid-cols-[1fr_1.5fr] border-b px-4 py-4">
                <dt>Total</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
            </dl>
            <Link
              href="/checkout/"
              className="bg-brand hover:bg-brand-dark mt-6 block rounded-lg py-5 text-center text-lg text-white transition-colors"
            >
              Proceed to checkout
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
