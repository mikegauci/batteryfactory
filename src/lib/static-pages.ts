import { PAGE_FIELDS } from "@/lib/page-fields";
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";

export async function getStaticPage(path: string) {
  "use cache";
  cacheTag("pages", `page:${path}`);
  cacheLife("hours");
  const { data, error } = await publicDb
    .from("pages")
    .select("*")
    .eq("path", path)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStandalonePages() {
  "use cache";
  cacheTag("pages");
  cacheLife("hours");
  const { data, error } = await publicDb
    .from("pages")
    .select("path,updated_at,seo")
    .eq("status", "published");
  if (error) throw error;
  return data;
}

export async function getPageImage(id: string) {
  "use cache";
  cacheTag("pages");
  cacheLife("hours");
  const { data, error } = await publicDb
    .from("media")
    .select("path,width,height,alt")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPageFields(path: string) {
  const page = await getStaticPage(path);
  const seo = page?.seo;
  const stored =
    seo && typeof seo === "object" && !Array.isArray(seo)
      ? seo.content_fields
      : null;
  const fields =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored
      : {};
  return Object.fromEntries(
    Object.entries(PAGE_FIELDS[path] ?? {}).map(([key, field]) => [
      key,
      typeof fields[key] === "string" ? (fields[key] as string) : field.value,
    ]),
  );
}
