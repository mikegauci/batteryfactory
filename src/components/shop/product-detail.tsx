"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import {
  addonsOf,
  available,
  hasPrice,
  price,
  priceLabel,
  type Category,
  type Product,
} from "@/lib/shop-types";
import { useCart } from "./cart";
import { ProductPlaceholder } from "./product-placeholder";
import { WooNotice } from "./woo-notice";

const select =
  "focus:border-brand w-full appearance-none border border-[#d1d5db] bg-white bg-[length:18px] bg-[right_12px_center] bg-no-repeat px-2.5 py-2 text-[15px] font-normal text-muted focus:outline-none";

// The WooCommerce single product layout: gallery on the left; breadcrumb,
// category, title, price, description, options and add to cart on the right.
export function ProductDetail({
  product: p,
  breadcrumb,
  category,
  whatsappUrl,
}: {
  product: Product;
  breadcrumb: Category[];
  category: Category | null;
  whatsappUrl: string;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const { add, added } = useCart();
  const options = p.options as { name: string; values: string[] }[];
  const addons = addonsOf(p);
  const complete = options.every((o) => selection[o.name]);
  const variant = complete
    ? [...p.variants]
        .sort((a, b) => a.sort_order - b.sort_order)
        .find((v) =>
          Object.entries(v.option_values as Record<string, string>).every(
            ([k, v]) => !v || selection[k] === v,
          ),
        )
    : null;
  const variable = p.variants.length > 0;
  const base = variable ? variant : p;
  const ready =
    !!base &&
    hasPrice(base) &&
    available(p, quantity) &&
    available(base, quantity);
  const addonTotal = addons
    .filter((a) => chosen.includes(a.id))
    .reduce((n, a) => n + a.price_cents, 0);
  const gallery = [
    p.image,
    ...[...p.gallery]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => g.image),
  ].filter((i) => i !== null);
  const image = photo ?? variant?.image?.path ?? p.image?.path;
  const priceText = priceLabel(p, formatPrice);
  const purchasable = !variable
    ? hasPrice(p) && available(p)
    : p.variants.some(hasPrice);

  return (
    <>
      {added?.slug === p.slug && (
        <WooNotice action={{ label: "View cart", href: "/cart/" }}>
          “{p.name}” has been added to your cart.
        </WooNotice>
      )}
      <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[600px_1fr]">
        <div>
          <div className="relative">
            {image ? (
              <Image
                width={1200}
                height={1200}
                priority
                src={mediaUrl(image)}
                alt={p.image?.alt || p.name}
                sizes="(min-width: 768px) 600px, 100vw"
                className="aspect-square w-full object-cover"
              />
            ) : (
              <ProductPlaceholder className="aspect-square w-full" />
            )}
            {image && (
              <a
                href={mediaUrl(image)}
                target="_blank"
                rel="noopener"
                aria-label="View full-size image"
                className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                  <circle
                    cx="10.5"
                    cy="10.5"
                    r="6.5"
                    fill="none"
                    stroke="#424142"
                    strokeWidth="2"
                  />
                  <path d="m15.5 15.5 5 5" stroke="#424142" strokeWidth="2" />
                </svg>
              </a>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              {gallery.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhoto(im.path)}
                  aria-label={`View photo ${i + 1}`}
                  className={
                    (photo ?? p.image?.path) === im.path
                      ? ""
                      : "opacity-50 hover:opacity-100"
                  }
                >
                  <Image
                    width={300}
                    height={300}
                    src={mediaUrl(im.path)}
                    alt={im.alt}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <nav aria-label="Breadcrumb" className="text-muted text-sm">
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
            {breadcrumb.map((c) => (
              <span key={c.id}>
                {" / "}
                <Link
                  href={`/product-category/${c.slug}/`}
                  className="hover:text-brand"
                >
                  {c.name}
                </Link>
              </span>
            ))}
            {" / "}
            {p.name}
          </nav>
          {category && (
            <Link
              href={`/product-category/${category.slug}/`}
              className="text-brand mt-4 block w-fit"
            >
              {category.name}
            </Link>
          )}
          <h1 className="text-ink border-brand mt-3 w-fit border-b text-xl leading-[1.4] font-black">
            {p.name}
          </h1>
          {priceText && !variable && (
            <p className="text-ink mt-5 text-2xl font-black">{priceText}</p>
          )}
          {priceText && variable && !p.short_description && (
            <p className="text-ink mt-5 text-2xl font-black">{priceText}</p>
          )}
          {p.short_description && (
            <div
              className="prose-bf mt-4 leading-[1.65]"
              dangerouslySetInnerHTML={{ __html: p.short_description }}
            />
          )}

          {purchasable && (
            <div className="mt-8">
              {options.map((o) => (
                <label key={o.name} className="mb-4 block">
                  <span className="mb-2 block text-sm font-black">
                    {o.name}
                  </span>
                  <span className="relative block">
                    <select
                      value={selection[o.name] ?? ""}
                      onChange={(e) => {
                        setSelection({
                          ...selection,
                          [o.name]: e.target.value,
                        });
                        setPhoto(null);
                      }}
                      className={select}
                    >
                      <option value="">Choose an option</option>
                      {o.values.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 20 20"
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                      aria-hidden
                    >
                      <path
                        d="m5 8 5 5 5-5"
                        fill="none"
                        stroke="#424142"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </span>
                </label>
              ))}
              {variable && Object.values(selection).some(Boolean) && (
                <button
                  type="button"
                  onClick={() => setSelection({})}
                  className="text-brand mb-2 text-sm"
                >
                  Clear
                </button>
              )}
              {variable && complete && variant && (
                <p className="text-ink mb-4 text-2xl font-black">
                  {hasPrice(variant) ? formatPrice(price(variant)) : ""}
                  {!available(variant) && (
                    <span className="text-coral block text-base font-medium">
                      Out of stock
                    </span>
                  )}
                </p>
              )}
              {variable && complete && !variant && (
                <p className="mb-4">
                  Sorry, this product is unavailable. Please choose a different
                  combination.
                </p>
              )}
              {addons.length > 0 && (
                <div className="border-line mt-2 space-y-1.5 border-t pt-6 text-[15px] font-normal">
                  {addons.map((a) => (
                    <label key={a.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={chosen.includes(a.id)}
                        onChange={(e) =>
                          setChosen(
                            e.target.checked
                              ? [...chosen, a.id]
                              : chosen.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <span>
                        {a.label}{" "}
                        <span className="text-muted">
                          (+{formatPrice(a.price_cents)})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div
                className={`flex flex-wrap items-center gap-5 ${
                  options.length || addons.length
                    ? "border-line mt-6 border-t pt-8"
                    : ""
                }`}
              >
                <Quantity value={quantity} onChange={setQuantity} />
                <button
                  type="button"
                  disabled={!ready}
                  className="shop-button disabled:opacity-50"
                  onClick={() => {
                    if (!base) return;
                    add({
                      productId: p.id,
                      variantId: variant?.id ?? null,
                      quantity,
                      name: p.name,
                      slug: p.slug,
                      price: price(base) + addonTotal,
                      image: image ? mediaUrl(image) : null,
                      options: selection,
                      addons: addons
                        .filter((a) => chosen.includes(a.id))
                        .map((a) => ({
                          id: a.id,
                          label: a.label,
                          price: a.price_cents,
                        })),
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Add to cart
                </button>
                {p.contact_button && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener"
                    className="shop-button"
                  >
                    Contact us now
                  </a>
                )}
              </div>
            </div>
          )}
          {!purchasable && p.contact_button && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener"
              className="shop-button mt-8"
            >
              Contact us now
            </a>
          )}
          {!purchasable && !variable && !available(p) && (
            <p className="text-coral mt-6">Out of stock</p>
          )}
        </div>
      </div>
      {p.description && (
        <div
          className="prose-bf border-line mt-14 border-t pt-8"
          dangerouslySetInnerHTML={{ __html: p.description }}
        />
      )}
    </>
  );
}

// WooCommerce's quantity box with "-" and "+" buttons.
export function Quantity({
  value,
  onChange,
  label = "Quantity",
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const set = (n: number) => onChange(Math.max(1, Math.min(99, n || 1)));
  const button =
    "grid h-10 w-[38px] place-items-center border border-[#d1d5db] text-sm";
  return (
    <span className="inline-flex">
      <button
        type="button"
        className={button}
        aria-label="Minus Quantity"
        onClick={() => set(value - 1)}
      >
        -
      </button>
      <input
        type="number"
        min="1"
        max="99"
        aria-label={label}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="h-10 w-10 [appearance:textfield] border-y border-[#d1d5db] text-center text-sm [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={button}
        aria-label="Plus Quantity"
        onClick={() => set(value + 1)}
      >
        +
      </button>
    </span>
  );
}
