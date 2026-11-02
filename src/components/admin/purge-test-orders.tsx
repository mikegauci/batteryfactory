"use client";
import { useActionState, useState } from "react";
import { purgeTestOrders } from "@/app/(admin)/admin/orders/actions";

// Two-step button: test orders are deleted only after confirming.
export function PurgeTestOrders() {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(purgeTestOrders, {
    message: "",
  });
  return (
    <form action={action} className="mb-5 flex items-center gap-3 text-sm">
      {confirming ? (
        <>
          <button
            disabled={pending}
            className="bg-coral rounded px-3 py-2 font-bold text-white"
          >
            {pending ? "Deleting…" : "Yes, delete all test orders"}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-black/20 bg-white px-3 py-2"
        >
          Delete test orders and restore their stock
        </button>
      )}
      <span role="status">{state.message}</span>
    </form>
  );
}
