import Link from "next/link";

// WooCommerce's message box: grey with a blue outline and a green tick.
export function WooNotice({
  children,
  action,
  tone = "success",
}: {
  children: React.ReactNode;
  action?: { label: string; href: string };
  tone?: "success" | "info" | "error";
}) {
  const icon =
    tone === "error" ? (
      <circle cx="10" cy="10" r="9" className="fill-coral" />
    ) : (
      <>
        <circle cx="10" cy="10" r="9" className="fill-brand" />
        <path
          d="m6 10.2 2.7 2.7L14 7.6"
          fill="none"
          stroke="white"
          strokeWidth="2"
        />
      </>
    );
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[3px] border-2 bg-[#f5f5f5] py-[18px] pr-8 pl-6 ${
        tone === "error" ? "border-coral" : "border-[#1e73be]"
      }`}
    >
      <p className="flex items-center gap-3">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden>
          {icon}
        </svg>
        <span>{children}</span>
      </p>
      {action && (
        <Link href={action.href} className="shop-button">
          {action.label}
        </Link>
      )}
    </div>
  );
}
