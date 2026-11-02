import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductEditor } from "@/components/admin/product-editor";
import type { ProductInput } from "../actions";
import { AdminPageHeader } from "@/components/admin/page-header";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const db = await createClient();
  const { data: p, error } = await db
    .from("products")
    .select(
      "*,variants:product_variants(*),gallery:product_media(media_id,sort_order)",
    )
    .eq("id", (await params).id)
    .maybeSingle();
  if (error) throw error;
  if (!p) notFound();
  const ids = [
    p.featured_media_id,
    ...p.variants.map((v) => v.image_media_id),
    ...p.gallery.map((v) => v.media_id),
  ].filter((v): v is string => !!v);
  const { data: media } = await db
    .from("media")
    .select("id,path,width,height,alt")
    .in("id", ids);
  return (
    <>
      <AdminPageHeader title="Edit product" />
      <ProductEditor
        initial={{
          ...p,
          options: p.options as ProductInput["options"],
          seo: p.seo as ProductInput["seo"],
          gallery: p.gallery
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => v.media_id),
        }}
        media={media ?? []}
      />
    </>
  );
}
