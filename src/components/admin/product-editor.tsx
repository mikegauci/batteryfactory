"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MediaField, type PickedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  saveProduct,
  type ProductInput,
} from "@/app/(admin)/admin/products/actions";
export const blankProduct: ProductInput = {
  id: null,
  name: "",
  slug: "",
  short_description: "",
  description: "",
  sku: null,
  price_cents: 0,
  sale_price_cents: null,
  manage_stock: false,
  stock_quantity: null,
  stock_status: "in_stock",
  options: [],
  featured_media_id: null,
  status: "draft",
  sort_order: 0,
  seo: {},
  gallery: [],
  variants: [],
};
const field = "w-full rounded border border-black/20 bg-white p-2 text-sm";
const panel = "space-y-4 rounded-lg bg-white p-5 shadow-sm";
export function ProductEditor({
  initial,
  media = [],
}: {
  initial: ProductInput;
  media?: PickedMedia[];
}) {
  const [p, setP] = useState(initial);
  const [images, setImages] = useState(media);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<ProductInput>) =>
    setP((v) => ({ ...v, ...patch }));
  const priceField = (
    label: string,
    key: "price_cents" | "sale_price_cents",
    object: { price_cents: number | null; sale_price_cents: number | null },
    update: (value: Partial<typeof object>) => void,
  ) => (
    <label className="block text-sm">
      {label} (€ incl. VAT)
      <input
        className={field}
        type="number"
        min="0"
        step="0.01"
        value={object[key] === null ? "" : object[key]! / 100}
        onChange={(e) =>
          update({
            [key]:
              e.target.value === ""
                ? null
                : Math.round(Number(e.target.value) * 100),
          })
        }
      />
    </label>
  );
  const stockFields = (
    object: Pick<
      ProductInput,
      "stock_status" | "manage_stock" | "stock_quantity"
    >,
    update: (value: Partial<typeof object>) => void,
  ) => (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">
        Stock status
        <select
          className={field}
          value={object.stock_status}
          onChange={(e) =>
            update({
              stock_status: e.target.value as ProductInput["stock_status"],
            })
          }
        >
          <option value="in_stock">In stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="on_backorder">On backorder</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={object.manage_stock}
          onChange={(e) => update({ manage_stock: e.target.checked })}
        />
        Track quantity
      </label>
      <label className="text-sm">
        Quantity
        <input
          type="number"
          min="0"
          step="1"
          className={field}
          value={object.stock_quantity ?? ""}
          onChange={(e) =>
            update({
              stock_quantity:
                e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
    </div>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const result = await saveProduct(p);
          if ("error" in result) setError(result.error);
          else {
            set({ id: result.id });
            setError("Saved.");
            router.replace(`/admin/products/${result.id}/`);
            router.refresh();
          }
        });
      }}
      className="grid gap-6 lg:grid-cols-[1fr_300px]"
    >
      <div className="space-y-6">
        <section className={panel}>
          <label className="block">
            Name
            <input
              required
              className={field}
              value={p.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            URL slug
            <input
              className={field}
              value={p.slug}
              onChange={(e) => set({ slug: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            SKU
            <input
              className={field}
              value={p.sku ?? ""}
              onChange={(e) => set({ sku: e.target.value || null })}
            />
          </label>
          <h2 className="font-bold">Short description</h2>
          <RichTextEditor
            value={p.short_description}
            onChange={(short_description) => set({ short_description })}
          />
          <h2 className="font-bold">Description</h2>
          <RichTextEditor
            value={p.description}
            onChange={(description) => set({ description })}
          />
        </section>
        <section className={panel}>
          <h2 className="font-bold">Price & stock</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {priceField("Regular price", "price_cents", p, set)}
            {priceField("Sale price", "sale_price_cents", p, set)}
          </div>
          {stockFields(p, set)}
        </section>
        <section className={panel}>
          <h2 className="font-bold">Options & variants</h2>
          {p.options.map((o, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                Option name
                <input
                  className={field}
                  value={o.name}
                  onChange={(e) =>
                    set({
                      options: p.options.map((v, j) =>
                        j === i ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Values (separate with |)
                <input
                  className={field}
                  value={o.values.join(" | ")}
                  onChange={(e) =>
                    set({
                      options: p.options.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              values: e.target.value
                                .split("|")
                                .map((v) => v.trim()),
                            }
                          : v,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="text-coral text-left text-sm"
                onClick={() =>
                  set({ options: p.options.filter((_, j) => j !== i) })
                }
              >
                Remove option
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm underline"
            onClick={() =>
              set({ options: [...p.options, { name: "", values: [] }] })
            }
          >
            Add option
          </button>
          {p.variants.map((v, i) => {
            const patch = (value: Partial<typeof v>) =>
              set({
                variants: p.variants.map((old, j) =>
                  j === i ? { ...old, ...value } : old,
                ),
              });
            return (
              <div
                key={v.id}
                className="space-y-3 border-t border-black/15 pt-4"
              >
                <h3 className="font-semibold">Variant {i + 1}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.options.map((o) => (
                    <label key={o.name} className="text-sm">
                      {o.name}
                      <select
                        className={field}
                        value={
                          (v.option_values as Record<string, string>)[o.name] ??
                          ""
                        }
                        onChange={(e) =>
                          patch({
                            option_values: {
                              ...(v.option_values as Record<string, string>),
                              [o.name]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Choose…</option>
                        {o.values.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {priceField("Regular price", "price_cents", v, (value) =>
                    patch({
                      ...value,
                      price_cents:
                        value.price_cents === null
                          ? 0
                          : (value.price_cents ?? v.price_cents),
                    }),
                  )}
                  {priceField("Sale price", "sale_price_cents", v, (value) =>
                    patch({ sale_price_cents: value.sale_price_cents }),
                  )}
                  <label className="text-sm">
                    SKU
                    <input
                      className={field}
                      value={v.sku ?? ""}
                      onChange={(e) => patch({ sku: e.target.value || null })}
                    />
                  </label>
                </div>
                {stockFields(v, patch)}
                <MediaField
                  label="Variant image"
                  value={images.find((m) => m.id === v.image_media_id) ?? null}
                  onChange={(m) => {
                    if (m) setImages([...images, m]);
                    patch({ image_media_id: m?.id ?? null });
                  }}
                />
                <button
                  type="button"
                  className="text-coral text-sm"
                  onClick={() =>
                    set({ variants: p.variants.filter((_, j) => j !== i) })
                  }
                >
                  Remove variant
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="block text-sm underline"
            onClick={() =>
              set({
                variants: [
                  ...p.variants,
                  {
                    id: crypto.randomUUID(),
                    option_values: {},
                    sku: null,
                    price_cents: p.price_cents ?? 0,
                    sale_price_cents: null,
                    manage_stock: false,
                    stock_quantity: null,
                    stock_status: "in_stock",
                    image_media_id: null,
                  },
                ],
              })
            }
          >
            Add variant
          </button>
        </section>
        <section className={panel}>
          <h2 className="font-bold">Gallery</h2>
          {p.gallery.map((id, i) => (
            <div key={id}>
              <MediaField
                label={`Photo ${i + 1}`}
                value={images.find((m) => m.id === id) ?? null}
                onChange={(m) => {
                  if (m) setImages([...images, m]);
                  set({
                    gallery: m
                      ? p.gallery.map((v, j) => (j === i ? m.id : v))
                      : p.gallery.filter((v) => v !== id),
                  });
                }}
              />
            </div>
          ))}
          <MediaField
            label="Add gallery photo"
            value={null}
            onChange={(m) => {
              if (m && !p.gallery.includes(m.id)) {
                setImages([...images, m]);
                set({ gallery: [...p.gallery, m.id] });
              }
            }}
          />
        </section>
        <section className={panel}>
          <h2 className="font-bold">SEO</h2>
          <label className="block text-sm">
            Title
            <input
              className={field}
              value={p.seo.title ?? ""}
              placeholder={`${p.name} | Battery Factory`}
              onChange={(e) =>
                set({ seo: { ...p.seo, title: e.target.value } })
              }
            />
            <span className="text-muted text-xs">The full browser title.</span>
          </label>
          <label className="block text-sm">
            Description
            <textarea
              className={field}
              value={p.seo.description ?? ""}
              onChange={(e) =>
                set({ seo: { ...p.seo, description: e.target.value } })
              }
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.seo.noindex}
              onChange={(e) =>
                set({ seo: { ...p.seo, noindex: e.target.checked } })
              }
            />
            Hide from search engines
          </label>
        </section>
      </div>
      <aside className="space-y-6">
        <section className={panel}>
          <label className="block text-sm">
            Status
            <select
              className={field}
              value={p.status}
              onChange={(e) =>
                set({ status: e.target.value as ProductInput["status"] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <label className="block text-sm">
            Order
            <input
              className={field}
              type="number"
              value={p.sort_order}
              onChange={(e) => set({ sort_order: Number(e.target.value) })}
            />
          </label>
          <button disabled={pending} className="shop-button w-full">
            {pending ? "Saving…" : "Save product"}
          </button>
          <p role="status" className="text-sm">
            {error}
          </p>
        </section>
        <section className={panel}>
          <MediaField
            label="Featured image"
            value={images.find((m) => m.id === p.featured_media_id) ?? null}
            onChange={(m) => {
              if (m) setImages([...images, m]);
              set({ featured_media_id: m?.id ?? null });
            }}
          />
        </section>
      </aside>
    </form>
  );
}
