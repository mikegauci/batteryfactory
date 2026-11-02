import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCatalogueProducts } from "@/lib/shop";
import { ProductCard } from "./product-card";
import { Container } from "@/components/layout/container";
import { mediaUrl } from "@/lib/media";
export async function Catalogue({ page = 1 }: { page?: number }) {
  const products = await getCatalogueProducts();
  const pages = Math.ceil(products.length / 9);
  if (!Number.isInteger(page) || page < 1 || page > pages) notFound();
  return (
    <>
      <section
        className="desk:h-[550px] flex h-[480px] items-center justify-center bg-cover bg-center"
        style={{
          backgroundImage: `url(${mediaUrl("wp/2021/05/shop-banner-image.webp")})`,
        }}
      >
        <Image
          unoptimized
          width={1000}
          height={1000}
          src={"/shop/shop-logo.png"}
          alt="Rotta Shop — Automotive Goodies"
          className="w-[320px] max-w-[80%]"
        />
      </section>
      <Container className="desk:py-16 py-10">
        <h1 className="text-ink mb-10 text-center text-3xl font-black">
          Latest Products
        </h1>
        <div className="desk:grid-cols-3 grid gap-x-7 gap-y-12 sm:grid-cols-2">
          {products.slice((page - 1) * 9, page * 9).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        <nav
          aria-label="Shop pages"
          className="mt-12 flex justify-center gap-3"
        >
          {Array.from({ length: pages }, (_, i) => (
            <Link
              key={i}
              aria-current={page === i + 1 ? "page" : undefined}
              href={i ? `/shop/page/${i + 1}/` : "/shop/"}
              className="aria-[current=page]:bg-brand border border-black/20 px-4 py-2"
            >
              {i + 1}
            </Link>
          ))}
        </nav>
      </Container>
    </>
  );
}
