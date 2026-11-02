import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PageEditor } from "@/components/admin/page-editor";
import { createClient } from "@/lib/supabase/server";
import { getPageFields } from "@/lib/static-pages";
import { hasManagedContent } from "@/lib/page-content";
import type { PageInput } from "../actions";
export const metadata = { title: "Edit page" };
export default async function EditPage({
  params,
}: PageProps<"/admin/pages/[id]">) {
  const { id } = await params;
  const db = await createClient();
  const { data: page, error } = await db
    .from("pages")
    .select("*,hero:media(id,path,width,height,alt)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!page) notFound();
  return (
    <>
      <AdminPageHeader title={`Edit ${page.title}`} />
      <PageEditor
        key={id}
        initial={{
          id: page.id,
          path: page.path,
          title: page.title,
          content: page.content,
          status: page.status,
          heroMediaId: page.hero_media_id,
          seo: (page.seo ?? {}) as PageInput["seo"],
          managedContent: hasManagedContent(page.seo),
          contentFields: await getPageFields(page.path),
        }}
        hero={page.hero}
      />
    </>
  );
}
