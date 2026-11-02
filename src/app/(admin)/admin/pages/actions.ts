"use server";
import { env } from "@/lib/env";
import { revalidatePath, updateTag } from "next/cache";
import { assertAdmin } from "@/lib/auth/admin";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { PAGE_FIELDS } from "@/lib/page-fields";
import { pageContentMode } from "@/lib/page-content";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type PageInput = {
  id: string | null;
  path: string;
  title: string;
  content: string;
  status: "draft" | "published";
  heroMediaId: string | null;
  managedContent: boolean;
  contentFields?: Record<string, string>;
  seo: {
    title?: string;
    description?: string;
    canonical?: string;
    noindex?: boolean;
  };
};
export async function savePage(
  input: PageInput,
): Promise<{ error: string } | { id: string }> {
  await assertAdmin("pages");
  if (!input.title?.trim()) return { error: "Add a title." };
  if (!["draft", "published"].includes(input.status))
    return { error: "Unknown status." };
  const db = await createClient();
  const previous = input.id
    ? await db.from("pages").select("*").eq("id", input.id).single()
    : null;
  if (previous?.error) return { error: previous.error.message };
  const path = previous?.data?.path ?? slugify(input.path);
  if (
    !input.id &&
    (!path ||
      RESERVED_SLUGS.has(path) ||
      ["robots-txt", "sitemap-xml", "favicon-ico"].includes(path))
  )
    return {
      error: "Choose an unused page URL, outside the existing site sections.",
    };
  const mode = pageContentMode(path);
  const isCodePage = RESERVED_SLUGS.has(path) || path === "";
  const previousSeo = previous?.data?.seo;
  const seo: Record<string, Json | undefined> =
    previousSeo &&
    typeof previousSeo === "object" &&
    !Array.isArray(previousSeo)
      ? { ...previousSeo }
      : {};
  seo.title = input.seo.title?.trim() || undefined;
  seo.description = input.seo.description?.trim() || undefined;
  const canonical = input.seo.canonical?.trim() || "";
  if (
    canonical &&
    !/^https?:\/\/[^\s]+$/.test(canonical) &&
    !/^\/(?!\/)[^\s]*$/.test(canonical)
  )
    return { error: "Canonical must be a site path or an http(s) URL." };
  seo.canonical = canonical || undefined;
  seo.noindex = Boolean(input.seo.noindex);
  if (mode !== "seo") seo.managed_content = Boolean(input.managedContent);
  if (input.contentFields && PAGE_FIELDS[path]) {
    const fields: Record<string, string> = {};
    for (const key of Object.keys(PAGE_FIELDS[path])) {
      const value = input.contentFields[key] ?? PAGE_FIELDS[path][key].value;
      if (typeof value !== "string" || value.length > 5000)
        return { error: "Page text must be under 5,000 characters per field." };
      if (key === "videoId" && !/^[a-zA-Z0-9_-]{11}$/.test(value))
        return { error: "Enter the 11-character YouTube video ID." };
      if (key.endsWith("Url") && !/^\/(?!\/)[^\s]*$/.test(value))
        return { error: "Story URL must be a path on this site." };
      if (
        ["storyImage", "heroImage"].includes(key) &&
        (!value || /[\x00-\x1f:?#]/.test(value) || value.startsWith("/"))
      )
        return { error: "Select an image from the media library." };
      if (
        key === "homeOrder" &&
        value.split(",").sort().join(",") !== "directory,events,intro,shop"
      )
        return { error: "Every homepage section must appear exactly once." };
      if (key === "heroMode" && !["video", "image"].includes(value))
        return { error: "Choose a video or image hero." };
      if (
        key === "heroVideo" &&
        !(
          /^\/(?!\/)[^\s]*\.mp4$/.test(value) ||
          (value.startsWith(
            env.supabaseUrl + "/storage/v1/object/public/media/",
          ) &&
            /\.mp4$/.test(value))
        )
      )
        return {
          error:
            "Use a local MP4 path or a public MP4 URL from the media library.",
        };
      fields[key] = value;
    }
    seo.content_fields = fields;
  }
  const row = {
    path,
    title: input.title.trim(),
    seo,
    status: isCodePage ? ("published" as const) : input.status,
    content: mode === "seo" ? (previous?.data?.content ?? "") : input.content,
    hero_media_id:
      mode === "seo" ? previous?.data?.hero_media_id : input.heroMediaId,
  };
  const saved = input.id
    ? await db
        .from("pages")
        .update(row)
        .eq("id", input.id)
        .select("id")
        .single()
    : await db.from("pages").insert(row).select("id").single();
  if (saved.error)
    return {
      error:
        saved.error.code === "23505"
          ? "A page already uses this URL."
          : saved.error.message,
    };
  updateTag("pages");
  updateTag(`page:${path}`);
  revalidatePath(path ? `/${path}/` : "/");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/pages/");
  return { id: saved.data.id };
}
