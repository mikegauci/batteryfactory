import Image from "next/image";
import { mediaUrl } from "@/lib/media";
import type { MediaInfo } from "@/lib/media-info";

// The Spectra "section" hero used across the live site: a cover image with a
// 35% black overlay, 180px vertical padding and a white heading.
export function PageHero({
  image,
  title,
  subtitle,
  priority = true,
}: {
  image: MediaInfo | null;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <section className="bg-ink relative overflow-hidden px-5 py-[180px] text-white">
      {image && (
        <Image
          src={mediaUrl(image.path)}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-black opacity-35" />
      <div className="relative mx-auto max-w-[1140px]">
        <h1 className="mb-[15px] text-[40px] leading-[1.3] font-black capitalize">
          {title}
        </h1>
        {subtitle && <p className="text-base leading-6">{subtitle}</p>}
      </div>
    </section>
  );
}
