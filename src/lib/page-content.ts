// Existing imported HTML is retained until an editor explicitly enables it.
export const PAGE_CONTENT_AREAS: Record<string, string> = {
  "": "Homepage sections, above the contact form",
  "shop-batteries-and-accessories": "Introduction, above the product catalogue",
};
export function pageContentMode(path: string) {
  if (path in PAGE_CONTENT_AREAS) return "section";
  if (["cart", "checkout", "my-account"].includes(path)) return "seo";
  return "page";
}
export function hasManagedContent(seo: unknown): boolean {
  return Boolean(
    seo &&
    typeof seo === "object" &&
    "managed_content" in seo &&
    seo.managed_content === true,
  );
}
