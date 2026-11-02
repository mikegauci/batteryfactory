"use client";
import Link from "next/link";
import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { price, type Product } from "@/lib/shop-types";
import { useCart } from "./cart";

// The grid's AJAX "Add to cart": adds one item, then shows "View cart".
export function AddToCartButton({ product: p }: { product: Product }) {
  const { add } = useCart();
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="shop-button"
        onClick={() => {
          add({
            productId: p.id,
            variantId: null,
            quantity: 1,
            name: p.name,
            slug: p.slug,
            price: price(p),
            image: p.image ? mediaUrl(p.image.path) : null,
            options: {},
          });
          setDone(true);
        }}
      >
        Add to cart
      </button>
      {done && (
        <Link href="/cart/" className="text-brand underline">
          View cart
        </Link>
      )}
    </div>
  );
}
