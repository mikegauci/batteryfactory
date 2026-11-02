import { AdminPageHeader } from "@/components/admin/page-header";
import { PageEditor } from "@/components/admin/page-editor";
export const metadata = { title: "New page" };
export default function NewPage() {
  return (
    <>
      <AdminPageHeader
        title="New page"
        description="Create a standalone page at a new URL. Add its link to your content to help visitors find it."
      />
      <PageEditor
        initial={{
          id: null,
          path: "",
          title: "",
          content: "",
          status: "draft",
          heroMediaId: null,
          managedContent: true,
          seo: {},
        }}
        hero={null}
      />
    </>
  );
}
