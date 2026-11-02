import { getPageImage, getStaticPage } from "@/lib/static-pages";
import { StaticPageContent } from "@/components/managed-page-content";
import type { Seo } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { notFoundMetadata, pageMetadata } from "@/lib/seo";

// CMS pages live at the site root (/custom-battery-manufacturing/), as on
// WordPress. Static routes always win over this catch-all.
export async function generateMetadata({
  params,
}: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  if (!page) return notFoundMetadata;
  return pageMetadata({
    name: page.title,
    path: `/${page.path}/`,
    seo: page.seo as Seo,
    image: page.hero_media_id
      ? (await getPageImage(page.hero_media_id))?.path
      : null,
  });
}

async function PageView({ params }: Pick<PageProps<"/[slug]">, "params">) {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  if (!page) notFound();
  return <StaticPageContent page={page} />;
}

export default function Page(props: PageProps<"/[slug]">) {
  return (
    <Suspense>
      <PageView params={props.params} />
    </Suspense>
  );
}
