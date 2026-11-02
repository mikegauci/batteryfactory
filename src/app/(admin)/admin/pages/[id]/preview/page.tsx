import Link from "next/link";
import { notFound } from "next/navigation";
import { StaticPageContent } from "@/components/managed-page-content";
import { createClient } from "@/lib/supabase/server";
import { pageContentMode } from "@/lib/page-content";
export const metadata = { title: "Page preview" };
export default async function Preview({
  params,
}: PageProps<"/admin/pages/[id]/preview">) {
  const { id } = await params;
  const db = await createClient();
  const { data, error } = await db
    .from("pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return (
    <>
      <div className="mb-5 flex flex-wrap justify-between gap-3 rounded bg-white p-4 text-sm">
        <p>
          Saved content preview · {data.status}.{" "}
          {pageContentMode(data.path) === "section"
            ? "This area appears above the page’s tools and forms."
            : ""}
        </p>
        <Link className="underline" href={`/admin/pages/${id}/`}>
          ← Back to editor
        </Link>
      </div>
      {pageContentMode(data.path) === "section" ? (
        <iframe
          title={`Preview of ${data.title}`}
          src={data.path ? `/${data.path}/` : "/"}
          className="h-[75vh] w-full rounded border border-black/10 bg-white"
        />
      ) : (
        <StaticPageContent page={data} />
      )}
    </>
  );
}
