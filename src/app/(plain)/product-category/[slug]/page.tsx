import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Catalogue } from "@/components/shop/catalogue";
import { notFoundMetadata, pageMetadata } from "@/lib/seo";
import { getCategories, getProducts } from "@/lib/shop";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

// "Batteries Archives | Battery Factory", as Yoast titled category pages.
export async function generateMetadata({
  params,
}: PageProps<"/product-category/[slug]">) {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  if (!category) return notFoundMetadata;
  return pageMetadata({
    name: `${category.name} Archives`,
    path: `/product-category/${slug}/`,
  });
}

async function Category({
  params,
  searchParams,
}: PageProps<"/product-category/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  // Like WooCommerce, a category also lists the products of its subcategories.
  const ids = new Set([category.id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const c of categories)
      if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
  }
  const products = (await getProducts()).filter((p) =>
    p.categories.some((c) => c.category && ids.has(c.category.id)),
  );
  return (
    <Catalogue
      title={category.name}
      products={products}
      sort={typeof query.orderby === "string" ? query.orderby : ""}
    />
  );
}

export default function Page(props: PageProps<"/product-category/[slug]">) {
  return (
    <Suspense>
      <Category {...props} />
    </Suspense>
  );
}
