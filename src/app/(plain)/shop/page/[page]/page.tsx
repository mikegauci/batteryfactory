import { Suspense } from "react";
import { Catalogue } from "@/components/shop/catalogue";
import { getCatalogueProducts } from "@/lib/shop";
import { codePageMetadata } from "@/lib/seo";

// "Shop - Page 2 of 2 - Rotta", as Yoast titled it.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const page = Number((await params).page);
  const pages = Math.ceil((await getCatalogueProducts()).length / 9);
  const meta = await codePageMetadata(
    "shop",
    `Shop - Page ${page} of ${pages}`,
  );
  return {
    ...meta,
    alternates: { canonical: `/shop/page/${page}/` },
    openGraph: { ...meta.openGraph, url: `/shop/page/${page}/` },
  };
}
async function Content({ params }: { params: Promise<{ page: string }> }) {
  return <Catalogue page={Number((await params).page)} />;
}
export default function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  return (
    <Suspense>
      <Content params={params} />
    </Suspense>
  );
}
