import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDetail } from "@/components/shop/product-detail";
import { notFoundMetadata, pageMetadata, type Seo } from "@/lib/seo";
import {
  getCategories,
  getProduct,
  getProducts,
  getWhatsappUrl,
} from "@/lib/shop";
import { categoriesOf, type Category } from "@/lib/shop-types";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">) {
  const p = await getProduct((await params).slug);
  if (!p) return notFoundMetadata;
  return pageMetadata({
    name: p.name,
    path: `/product/${p.slug}/`,
    seo: (p.seo ?? {}) as Seo,
    description: p.short_description
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160),
    image: p.image?.path,
  });
}

// WooCommerce shows the deepest category, with its parents in the breadcrumb.
function primaryCategory(categories: Category[], all: Category[]) {
  const byId = new Map(all.map((c) => [c.id, c]));
  const depth = (c: Category): number =>
    c.parent_id && byId.has(c.parent_id)
      ? 1 + depth(byId.get(c.parent_id)!)
      : 0;
  const deepest = [...categories].sort((a, b) => depth(b) - depth(a))[0];
  const trail: Category[] = [];
  let c: Category | undefined = deepest;
  while (c) {
    trail.unshift(c);
    c = c.parent_id ? byId.get(c.parent_id) : undefined;
  }
  return { category: deepest ?? null, trail };
}

async function Content({
  params,
}: Pick<PageProps<"/product/[slug]">, "params">) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const [products, whatsappUrl, all] = await Promise.all([
    getProducts(),
    getWhatsappUrl(),
    getCategories(),
  ]);
  const categories = categoriesOf(p);
  const { category, trail } = primaryCategory(categories, all);
  const ids = new Set(categories.map((c) => c.id));
  const related = products
    .filter((v) => v.id !== p.id && categoriesOf(v).some((c) => ids.has(c.id)))
    .slice(0, 4);
  return (
    <Container className="pt-[60px] pb-20">
      <ProductDetail
        product={p}
        breadcrumb={trail}
        category={category}
        whatsappUrl={whatsappUrl}
      />
      {related.length > 0 && (
        <section className="mt-[100px]">
          <h2 className="text-ink mb-10 text-3xl font-black">
            Related products
          </h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
            {related.map((v) => (
              <ProductCard key={v.id} product={v} whatsappUrl={whatsappUrl} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}

export default function Page(props: PageProps<"/product/[slug]">) {
  return (
    <Suspense>
      <Content params={props.params} />
    </Suspense>
  );
}
