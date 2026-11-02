import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminThumbnail } from "@/components/admin/thumbnail";
import { createClient } from "@/lib/supabase/server";
import { pageContentMode } from "@/lib/page-content";
export const metadata = { title: "Pages" };
export default async function Pages({
  searchParams,
}: PageProps<"/admin/pages">) {
  const { q, status } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const filter = status === "draft" || status === "published" ? status : "";
  const db = await createClient();
  let query = db
    .from("pages")
    .select("id,path,title,status,updated_at,hero:media(path,alt)")
    .order("path");
  if (search) query = query.ilike("title", `%${search}%`);
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw error;
  return (
    <>
      <AdminPageHeader
        title="Pages"
        description="Manage page content, header images and search metadata."
        actions={
          <Link href="/admin/pages/new/" className="shop-button">
            New page
          </Link>
        }
      />
      <form className="mb-5 flex flex-wrap gap-3">
        <input
          aria-label="Search page titles"
          name="q"
          placeholder="Search titles"
          defaultValue={search}
          className="rounded border border-black/20 bg-white p-2 text-sm"
        />
        <select
          aria-label="Page status"
          name="status"
          defaultValue={filter}
          className="rounded bg-white p-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <button className="shop-button">Filter</button>
      </form>
      <div className="overflow-x-auto rounded-lg bg-white p-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Image", "Page", "Editing", "Status"].map((s) => (
                <th key={s} className="p-3">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-black/10">
                <td className="p-3">
                  <AdminThumbnail image={p.hero} />
                </td>
                <td className="p-3">
                  <Link
                    href={`/admin/pages/${p.id}/`}
                    className="font-bold hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="text-muted text-xs">
                    /{p.path}
                    {p.path ? "/" : ""}
                  </p>
                </td>
                <td className="p-3">
                  {pageContentMode(p.path) === "seo"
                    ? "SEO"
                    : pageContentMode(p.path) === "section"
                      ? "Content area + SEO"
                      : "Full page + SEO"}
                </td>
                <td className="p-3">{p.status}</td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={4} className="text-muted p-8 text-center">
                  No pages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
