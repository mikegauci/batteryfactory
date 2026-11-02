import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { getCurrentUser } from "@/lib/auth/session";
import { codePageMetadata } from "@/lib/seo";
import { getShopSettings } from "@/lib/shop";

export function generateMetadata() {
  return codePageMetadata("checkout", "Checkout", { noindex: true });
}

async function Checkout() {
  const [settings, user] = await Promise.all([
    getShopSettings(),
    getCurrentUser(),
  ]);
  const rate = settings.shipping.find((s) => s.countries.includes("MT"));
  return (
    <CheckoutForm
      email={user?.email}
      shipping={{
        freeFromCents: settings.free_shipping_min_cents ?? null,
        priceCents: rate?.price_cents ?? 0,
      }}
    />
  );
}

export default function Page() {
  return (
    <Container className="pt-[120px] pb-[60px]">
      <h1 className="section-title mb-11">Checkout</h1>
      <Suspense>
        <Checkout />
      </Suspense>
    </Container>
  );
}
