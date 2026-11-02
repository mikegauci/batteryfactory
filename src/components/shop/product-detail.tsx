"use client";
import Image from "next/image";
import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import { available, price, priceLabel, type Product } from "@/lib/shop-types";
import { useCart } from "./cart";
export function ProductDetail({ product: p }: { product: Product }) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const { add } = useCart();
  const options = p.options as { name: string; values: string[] }[];
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
  const ready =
    available(p, quantity) &&
    (!p.variants.length || (!!variant && available(variant, quantity)));
  const images = [
    p.image,
    ...p.gallery
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => g.image),
  ].filter((i) => i !== null);
  const image = photo ?? variant?.image?.path ?? p.image?.path;
  return (
    <>
      <div className="desk:grid-cols-2 grid gap-10">
        <div>
          {image && (
            <a href={mediaUrl(image)} target="_blank">
              <Image
                unoptimized
                width={1000}
                height={1000}
                src={mediaUrl(image)}
                alt={p.name}
                className="aspect-square w-full object-contain"
              />
            </a>
          )}
          <div className="mt-4 grid grid-cols-5 gap-3">
            {images.map((im, i) => (
              <button
                key={i}
                onClick={() => setPhoto(im.path)}
                aria-label={`View photo ${i + 1}`}
              >
                <Image
                  unoptimized
                  width={1000}
                  height={1000}
                  src={mediaUrl(im.path)}
                  alt={im.alt}
                  className="aspect-square object-cover"
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <h1 className="text-ink mb-5 text-3xl font-black">{p.name}</h1>
          <p className="mb-6 text-2xl">
            {variant ? formatPrice(price(variant)) : priceLabel(p, formatPrice)}
          </p>
          <div
            className="post-content mb-6"
            dangerouslySetInnerHTML={{ __html: p.short_description }}
          />
          {options.map((o) => (
            <fieldset key={o.name} className="mb-5">
              <legend className="mb-2 font-semibold">{o.name}</legend>
              <div className="flex flex-wrap gap-2">
                {o.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selection[o.name] === v}
                    onClick={() => {
                      setSelection({ ...selection, [o.name]: v });
                      setPhoto(null);
                    }}
                    className="aria-pressed:bg-brand min-w-10 border border-black/25 px-3 py-2"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {options.length > 0 && (
            <button
              onClick={() => setSelection({})}
              className="mb-5 text-sm underline"
            >
              Clear
            </button>
          )}
          {!available(p) ? (
            <p className="text-coral">Out of stock</p>
          ) : (
            <div className="flex items-end gap-4">
              <label className="text-sm">
                QTY:
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                    )
                  }
                  className="mt-2 block w-20 border border-black/20 p-3"
                />
              </label>
              <button
                disabled={!ready}
                className="shop-button"
                onClick={() =>
                  add({
                    productId: p.id,
                    variantId: variant?.id ?? null,
                    quantity,
                    name: p.name,
                    slug: p.slug,
                    price: price(variant ?? p),
                    image: image ? mediaUrl(image) : null,
                    options: selection,
                  })
                }
              >
                Add to cart
              </button>
            </div>
          )}
          {complete && variant && !available(variant) && (
            <p className="mt-3">This option is out of stock.</p>
          )}
        </div>
      </div>
      <div
        className="post-content mt-14 border-t border-black/15 pt-8"
        dangerouslySetInnerHTML={{ __html: p.description }}
      />
      {options.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold">Additional information</h2>
          {options.map((o) => (
            <p key={o.name} className="border-b border-black/10 py-3">
              <strong>{o.name}</strong>　{o.values.join(", ")}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
