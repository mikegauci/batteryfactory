import { codePageMetadata } from "@/lib/seo";
import { CartPage } from "@/components/shop/cart-page";
export function generateMetadata() {
  return codePageMetadata("cart", "Cart", { noindex: true });
}
export default function Page() {
  return <CartPage checkout={false} />;
}
