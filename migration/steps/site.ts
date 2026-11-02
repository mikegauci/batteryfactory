// Pages and redirects. The homepage, shop, cart, checkout and account pages
// are rebuilt in code; only their title and Yoast SEO come along. Other pages
// (Custom Battery Manufacturing) keep their HTML, edited in the CMS.
import type { Context } from "../lib/context.ts";
import { decodeEntities, wpDate } from "../lib/wp.ts";
import { seoFrom } from "./seo.ts";

const CODE_PAGES = new Set([
  "shop-batteries-and-accessories",
  "cart",
  "checkout",
  "my-account",
]);

export function importSite(ctx: Context) {
  const frontPage = ctx.wp.get(
    "select option_value from wp_options where option_name = 'page_on_front'",
  )?.option_value;
  const pages = ctx.wp.all(
    "select * from wp_posts where post_type = 'page' and post_parent = '0' and post_status = 'publish' order by cast(ID as integer)",
  );
  const meta = ctx.wp.postMeta(pages.map((p) => p.ID!));
  const pageRows = pages.map((p) => {
    const isHome = p.ID === frontPage;
    const path = isHome ? "" : p.post_name!;
    const inCode = isHome || CODE_PAGES.has(path);
    return {
      id: ctx.id("pages", p.ID!),
      wp_id: Number(p.ID),
      path,
      title: decodeEntities(p.post_title!),
      content: inCode ? "" : ctx.html(p.post_content),
      status: "published" as const,
      seo: seoFrom(ctx, meta.get(p.ID!), p.post_title ?? ""),
      created_at: wpDate(p.post_date_gmt, p.post_date) ?? undefined,
    };
  });
  ctx.upsert("pages", pageRows, "id");
  ctx.count("pages", pageRows.map((p) => `/${p.path}`).join(", "));

  // Images the homepage layout uses (its fields default to these paths).
  for (const file of [
    "2025/09/hero-section-batteries.jpg",
    "2025/09/what-we-do.jpg",
    "2025/09/custom-battery-manufacturing-icon.png",
    "2025/09/battery-repair-and-refurbishment.png",
    "2025/09/EV-conversions.png",
    "2025/09/B2B-battery-solutions.png",
    "2025/09/diagnostics-health-testing.png",
    "2025/09/life-can-be-easier-banner.jpg",
    "2025/09/life-can-be-easier-banner-mobile.jpg",
  ])
    ctx.media.byUrl(file);

  const site = {
    key: "site",
    value: {
      footer_address:
        "Battery Factory | B13b, Bulebel Industrial Estate | Zejtun ZTN3000",
      facebook_url: "https://www.facebook.com/batteryfactorymt",
    },
  };
  ctx.upsert("settings", [site], "key");
}
