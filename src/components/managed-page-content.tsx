import { getPageImage, getStaticPage } from "@/lib/static-pages";
import { hasManagedContent } from "@/lib/page-content";
import { PageHero } from "@/components/page-hero";
import type { Tables } from "@/lib/supabase/database.types";

export async function StaticPageContent({ page }: { page: Tables<"pages"> }) {
  const image = page.hero_media_id
    ? await getPageImage(page.hero_media_id)
    : null;
  return (
    <>
      <PageHero image={image} title={page.title} />
      {page.content && (
        <div
          className="post-content mx-auto max-w-[1140px] px-5 py-12"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}
    </>
  );
}

export async function ManagedPageContent({
  path,
  children,
  after,
}: {
  path: string;
  children?: React.ReactNode;
  after?: React.ReactNode;
}) {
  const page = await getStaticPage(path);
  if (!page || !hasManagedContent(page.seo)) return <>{children}</>;
  return (
    <>
      <StaticPageContent page={page} />
      {after}
    </>
  );
}
