import { Suspense } from "react";
import {
  Catalogue,
  CategoryLinks,
  ShopSearch,
} from "@/components/shop/catalogue";
import { codePageMetadata } from "@/lib/seo";
import { getCategories, getProducts } from "@/lib/shop";
import { getPageFields } from "@/lib/static-pages";

export function generateMetadata() {
  return codePageMetadata(
    "shop-batteries-and-accessories",
    "Shop batteries & accessories",
  );
}

async function Shop({
  searchParams,
}: PageProps<"/shop-batteries-and-accessories">) {
  const params = await searchParams;
  const query = typeof params.s === "string" ? params.s.trim() : "";
  const sort = typeof params.orderby === "string" ? params.orderby : "";
  const [fields, products, categories] = await Promise.all([
    getPageFields("shop-batteries-and-accessories"),
    getProducts(),
    getCategories(),
  ]);
  const found = query
    ? products.filter((p) =>
        `${p.name} ${p.short_description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : products;
  return (
    <Catalogue
      title={fields.heading}
      products={found}
      sort={sort}
      search={<ShopSearch value={query} />}
      sidebar={<CategoryLinks categories={categories} />}
    />
  );
}

export default function Page(
  props: PageProps<"/shop-batteries-and-accessories">,
) {
  return (
    <Suspense>
      <Shop {...props} />
    </Suspense>
  );
}
