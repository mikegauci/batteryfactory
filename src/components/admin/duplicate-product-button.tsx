"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateProduct } from "@/app/(admin)/admin/products/actions";
export function DuplicateProductButton({
  id,
  className = "shop-button",
}: {
  id: string;
  className?: string;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const result = await duplicateProduct(id).catch(() => ({
              error: "Could not duplicate this product. Please try again.",
            }));
            if ("error" in result) setError(result.error);
            else router.push(`/admin/products/${result.id}/`);
          })
        }
      >
        {pending ? "Duplicating…" : "Duplicate"}
      </button>
      {error && (
        <span role="alert" className="text-coral text-sm">
          {error}
        </span>
      )}
    </span>
  );
}
