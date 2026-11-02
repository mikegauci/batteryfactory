import { Container } from "@/components/layout/container";
import { CartPage } from "@/components/shop/cart-page";
import { codePageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return codePageMetadata("cart", "Cart", { noindex: true });
}

export default function Page() {
  return (
    <Container className="pt-[120px] pb-[90px]">
      <h1 className="section-title mb-11">Cart</h1>
      <CartPage />
    </Container>
  );
}
