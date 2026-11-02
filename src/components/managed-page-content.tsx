import { getStaticPage } from "@/lib/static-pages";
import { hasManagedContent } from "@/lib/page-content";
import { Container } from "@/components/layout/container";
import type { Tables } from "@/lib/supabase/database.types";

// A CMS page in the live theme's layout: thin title with the green rule,
// then the page content.
export async function StaticPageContent({ page }: { page: Tables<"pages"> }) {
  return (
    <Container className="min-h-[600px] pt-[60px] pb-20">
      <h1 className="section-title">{page.title}</h1>
      {page.content && (
        <div
          className="prose-bf mt-10"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}
    </Container>
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
