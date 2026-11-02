"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  ["menu_order", "Default sorting"],
  ["popularity", "Sort by popularity"],
  ["date", "Sort by latest"],
  ["price", "Sort by price: low to high"],
  ["price-desc", "Sort by price: high to low"],
] as const;

// WooCommerce's "orderby" dropdown; changing it reloads with ?orderby=.
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <span className="relative inline-block max-md:w-full">
      <select
        aria-label="Shop order"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value === "menu_order") next.delete("orderby");
          else next.set("orderby", e.target.value);
          const query = next.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className="text-muted max-md:text-body cursor-pointer appearance-none bg-transparent pr-[72px] text-[15px] font-normal max-md:w-full max-md:py-2 max-md:pl-2 max-md:text-base"
      >
        {OPTIONS.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2"
        aria-hidden
      >
        <path d="m5 8 5 5 5-5" fill="none" stroke="#424142" strokeWidth="1.6" />
      </svg>
    </span>
  );
}
