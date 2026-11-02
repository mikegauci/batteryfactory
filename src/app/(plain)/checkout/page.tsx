import { codePageMetadata } from "@/lib/seo";
import { CartPage } from "@/components/shop/cart-page";
export function generateMetadata() {
  return codePageMetadata("checkout", "Checkout", { noindex: true });
}
export default function Page() {
  return <CartPage checkout={true} />;
}
