import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaUsage } from "@/lib/admin/inventory";
import { MediaCard } from "@/components/admin/media-card";
export default async function Usage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();
  const { data, error } = await db
    .from("media")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const usage = await mediaUsage(id, data.path);
  return (
    <>
      <Link href="/admin/media/" className="underline">
        ← Media library
      </Link>
      <h1 className="my-5 text-2xl font-bold">File usage</h1>
      <div className="max-w-md">
        <MediaCard item={data} />
      </div>
      <h2 className="mt-6 font-bold">Current content references</h2>
      {usage.length ? (
        <ul>
          {usage.map((u, i) => (
            <li key={i} className="py-2">
              {u}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No current content references found. Links outside the CMS and past
          revisions are not included.
        </p>
      )}
    </>
  );
}
