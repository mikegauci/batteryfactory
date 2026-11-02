import { test } from "node:test";
import assert from "node:assert/strict";
import { brokenInternalLinks } from "../src/lib/admin/content-checks.ts";
import { siteNavigation } from "../src/lib/navigation.ts";
test("CMS link checks handle fragments, escaped paths, dynamic archives and external links", () => {
  const known = new Set([
    "/",
    "/shop",
    "/good-story",
    "/directory/my-business",
  ]);
  const html =
    '<a href="/good-story/?x=1#section">Good</a><a href="/missing/">Missing</a><a href="/missing/">Duplicate</a><a href="https://elsewhere.test/">External</a><a href="//elsewhere.test/">External</a><a href="/category/cars/">Category</a><a href="/directory/my-business/">Listing</a><a href="/product/deleted/">Deleted product</a>';
  assert.deepEqual(brokenInternalLinks(html, known), [
    "/missing/",
    "/product/deleted/",
  ]);
});
test("Navigation preserves configured order and refuses non-local or malformed URLs", () => {
  assert.deepEqual(siteNavigation("Shop | /shop/\nHome | /"), [
    { label: "Shop", href: "/shop/" },
    { label: "Home", href: "/" },
  ]);
  assert.equal(
    siteNavigation("Bad | javascript:alert(1)\nBad | //elsewhere.test")[0]
      .label,
    "Home",
  );
});
