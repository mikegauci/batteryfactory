// WooCommerce's placeholder for products without an image.
export function ProductPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center bg-[#f5f7f6] ${className}`}>
      <svg
        viewBox="0 0 120 120"
        className="w-1/2 max-w-[300px] fill-none stroke-[#a5a5a5]"
        aria-hidden
      >
        <rect x="2" y="2" width="116" height="116" strokeWidth="1.5" />
        <rect x="16" y="16" width="88" height="88" strokeWidth="1.5" />
        <circle cx="70" cy="40" r="12" strokeWidth="1.5" />
        <path
          d="M16 88 40 54l40 46M64 82l14-14 26 22M16 92c20-6 36-2 52 10"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
