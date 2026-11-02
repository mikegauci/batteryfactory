import Link from "next/link";
import Image from "next/image";
import { mediaUrl } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import { available, priceLabel, type Product } from "@/lib/shop-types";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <article className="text-center">
      <Link href={`/product/${p.slug}/`} className="relative mb-4 block">
        {p.image && (
          <Image
            unoptimized
            width={1000}
            height={1000}
            src={mediaUrl(p.image.path)}
            alt={p.image.alt || p.name}
            className="aspect-square w-full object-cover"
          />
        )}
        {!available(p) && (
          <span className="absolute inset-x-0 bottom-0 bg-white/90 py-3 text-sm uppercase">
            Out of stock
          </span>
        )}
      </Link>
      <Link href={`/product/${p.slug}/`} className="text-ink text-lg font-bold">
        {p.name}
      </Link>
      <p className="mt-2 text-sm">{priceLabel(p, formatPrice)}</p>
    </article>
  );
}
