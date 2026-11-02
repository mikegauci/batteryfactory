import Link from "next/link";
import Image from "next/image";
import { mediaUrl } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import {
  available,
  gridAction,
  priceLabel,
  type Product,
} from "@/lib/shop-types";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductPlaceholder } from "./product-placeholder";

// A product in the WooCommerce grid: image (with the "Out of stock" badge),
// name, price and the button WooCommerce picks for the product type.
export function ProductCard({
  product: p,
  whatsappUrl,
}: {
  product: Product;
  whatsappUrl: string;
}) {
  const href = `/product/${p.slug}/`;
  const action = gridAction(p);
  const priceText = priceLabel(p, formatPrice);
  return (
    <article>
      <Link href={href} className="relative block">
        {p.image ? (
          <Image
            width={600}
            height={600}
            src={mediaUrl(p.image.path)}
            alt={p.image.alt || p.name}
            sizes="(min-width: 922px) 285px, 50vw"
            className="aspect-[165/210] w-full object-cover lg:aspect-[285/250]"
          />
        ) : (
          <ProductPlaceholder className="aspect-[165/210] w-full lg:aspect-[285/250]" />
        )}
        {!available(p) && (
          <span className="text-brand absolute inset-x-4 bottom-4 bg-white/90 py-3 text-center text-sm font-black uppercase">
            Out of stock
          </span>
        )}
      </Link>
      <Link href={href}>
        <h2 className="text-ink mt-3 text-xl leading-[1.4] font-black">
          {p.name}
        </h2>
      </Link>
      {priceText && (
        <p className="text-ink mt-2 text-lg font-black">{priceText}</p>
      )}
      <div className="mt-5">
        {action === "contact" ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener"
            className="shop-button"
          >
            Contact us now
          </a>
        ) : action === "cart" ? (
          <AddToCartButton product={p} />
        ) : (
          <Link href={href} className="shop-button">
            {action === "options" ? "Select options" : "Read more"}
          </Link>
        )}
      </div>
    </article>
  );
}
