// Yoast SEO fields -> the `seo` jsonb on pages and products.
import type { Json } from "../../src/lib/supabase/database.types.ts";
import type { Context } from "../lib/context.ts";
import { decodeEntities } from "../lib/wp.ts";

// Fills in a Yoast title template ("%%title%% %%sep%% %%sitename%%").
function yoastTitle(template: string, title: string): string {
  return decodeEntities(template)
    .replace(/%%title%%/g, title)
    .replace(/%%sitename%%/g, "Battery Factory")
    .replace(/%%sitedesc%%/g, "Powering your future one battery at a time")
    .replace(/%%sep%%/g, "|")
    .replace(/%%page%%/g, "")
    .replace(/%%[a-z_]+%%/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// `seo.title` is the full browser title; it is only stored when it differs
// from the default "<title> | Battery Factory".
export function seoFrom(
  ctx: Context,
  meta: Map<string, string> | undefined,
  pageTitle = "",
): { [key: string]: Json } {
  if (!meta) return {};
  const seo: { [key: string]: Json } = {};
  const template = meta.get("_yoast_wpseo_title");
  const description = meta.get("_yoast_wpseo_metadesc");
  if (template) {
    const title = yoastTitle(template, decodeEntities(pageTitle));
    if (title && title !== `${decodeEntities(pageTitle)} | Battery Factory`)
      seo.title = title;
  }
  if (description && !description.includes("%%"))
    seo.description = decodeEntities(description);
  if (meta.get("_yoast_wpseo_meta-robots-noindex") === "1") seo.noindex = true;
  const canonical = meta.get("_yoast_wpseo_canonical");
  if (canonical) seo.canonical = canonical;
  const og = meta.get("_yoast_wpseo_opengraph-image-id");
  if (og) {
    const ref = ctx.media.byAttachment(og);
    if (ref) seo.og_media_id = ref.id;
  }
  return seo;
}
