export type NavItem = { label: string; href: string };

// The live menu: section anchors on the one-page home, plus the shop and the
// Plushbike product.
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/#about-us" },
  { label: "Services", href: "/#services" },
  { label: "Shop", href: "/shop-batteries-and-accessories/" },
  { label: "Plushbike", href: "/product/plushbike/" },
  { label: "FAQs", href: "/#faqs" },
  { label: "Contact", href: "/#contact" },
];

export const FACEBOOK_URL = "https://www.facebook.com/batteryfactorymt";

export function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  const normalise = (p: string) => p.replace(/\/+$/, "") || "/";
  const path = normalise(pathname);
  const target = normalise(href);
  return target === "/"
    ? path === "/"
    : path === target || path.startsWith(`${target}/`);
}

export function siteNavigation(lines?: string): NavItem[] {
  const items = (lines || "")
    .split("\n")
    .map((line) => {
      const [label, href] = line.split("|").map((s) => s.trim());
      return { label, href };
    })
    .filter((item) => item.label && /^\/(?!\/)[^\s]*$/.test(item.href));
  return items.length ? items : primaryNav;
}
