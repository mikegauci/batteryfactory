import Link from "next/link";
import { Container } from "@/components/layout/container";
import { getWhatsappUrl } from "@/lib/shop";
import { hasPrice, price, type Product } from "@/lib/shop-types";
import { ProductCard } from "./product-card";
import { SortSelect } from "./sort-select";

export const SORTS = {
  menu_order: "Default sorting",
  popularity: "Sort by popularity",
  date: "Sort by latest",
  price: "Sort by price: low to high",
  "price-desc": "Sort by price: high to low",
} as const;
export type Sort = keyof typeof SORTS;

const lowest = (p: Product) => {
  const values = (p.variants.length ? p.variants : [p])
    .filter(hasPrice)
    .map(price);
  return values.length ? Math.min(...values) : 0;
};

export function sortProducts(products: Product[], sort: string) {
  const list = [...products];
  if (sort === "date")
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  else if (sort === "price") list.sort((a, b) => lowest(a) - lowest(b));
  else if (sort === "price-desc") list.sort((a, b) => lowest(b) - lowest(a));
  // "popularity" has no sales yet, so it keeps the default order.
  return list;
}

// The WooCommerce archive: optional search and category sidebar (shop page
// only), result count, sorting and a four-column grid.
export async function Catalogue({
  title,
  products,
  sort,
  search,
  sidebar,
}: {
  title: string;
  products: Product[];
  sort: string;
  search?: React.ReactNode;
  sidebar?: React.ReactNode;
}) {
  const whatsappUrl = await getWhatsappUrl();
  const sorted = sortProducts(products, sort);
  const grid = (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">
          {sorted.length === 1
            ? "Showing the single result"
            : `Showing all ${sorted.length} results`}
        </p>
        <SortSelect value={sort in SORTS ? sort : "menu_order"} />
      </div>
      {sorted.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
          {sorted.map((p) => (
            <ProductCard key={p.id} product={p} whatsappUrl={whatsappUrl} />
          ))}
        </div>
      ) : (
        <p>No products were found matching your selection.</p>
      )}
    </div>
  );
  return (
    <Container className="pt-[60px] pb-20">
      <h1 className="section-title">{title}</h1>
      {search ?? <hr className="border-line mt-11 mb-12" />}
      {sidebar ? (
        <div className="grid gap-10 md:grid-cols-[150px_1fr] md:gap-12">
          <div>{sidebar}</div>
          {grid}
        </div>
      ) : (
        grid
      )}
    </Container>
  );
}

export function CategoryLinks({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  return (
    <ul className="space-y-2.5">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/product-category/${c.slug}/`}
            className="border-brand inline-block border-b pb-0.5 text-[15px] leading-tight"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ShopSearch({ value }: { value: string }) {
  return (
    <form
      role="search"
      action="/shop-batteries-and-accessories/"
      className="mt-12 mb-4"
    >
      <label htmlFor="shop-search" className="mb-1 block text-sm">
        Search
      </label>
      <div className="flex gap-2.5">
        <input
          id="shop-search"
          type="search"
          name="s"
          required
          defaultValue={value}
          className="focus:border-brand min-w-0 flex-1 border border-[#d1d5db] px-3 py-2 focus:outline-none"
        />
        <button type="submit" className="shop-button">
          Search
        </button>
      </div>
    </form>
  );
}
