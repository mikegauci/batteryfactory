import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Page not found | Battery Factory" },
  robots: { index: false },
};

// Unknown URLs and notFound() in any page, with the live site's wording.
export default function NotFound() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-[1240px] px-5 py-20 text-center">
        <h1 className="text-heading mb-4 text-[32px] leading-[1.2] font-bold md:text-[40px]">
          This page doesn’t seem to exist.
        </h1>
        <p className="mb-6">It looks like the link pointing here was faulty.</p>
        <Link href="/" className="hover:text-brand font-semibold underline">
          Back to the homepage
        </Link>
      </section>
    </SiteShell>
  );
}
