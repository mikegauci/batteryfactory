import { ManagedPageContent } from "@/components/managed-page-content";
import { codePageMetadata } from "@/lib/seo";
import { Catalogue } from "@/components/shop/catalogue";
export function generateMetadata() {
  return codePageMetadata("shop", "Shop", {
    image: "wp/2021/05/DSC01475.webp",
  });
}
export default function Shop() {
  return (
    <>
      <ManagedPageContent path="shop" />
      <Catalogue />
    </>
  );
}
