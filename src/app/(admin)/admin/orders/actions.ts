"use server";
import { assertAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Constants, type Enums } from "@/lib/supabase/database.types";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
type OrderFormState = {
  message: string;
  fields?: { status: string; note: string; visible: boolean };
};

export async function updateOrder(
  _previous: OrderFormState,
  form: FormData,
): Promise<OrderFormState> {
  await assertAdmin("orders");
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status")) as Enums<"order_status">;
  const note = String(form.get("note") ?? "").trim();
  const visible = form.get("visible") === "on";
  const fields = { status, note, visible };
  if (!Constants.public.Enums.order_status.includes(status))
    return { message: "Invalid status.", fields };
  if (note.length > 10000) return { message: "Note is too long.", fields };
  const db = await createClient();
  const { data: before, error: lookup } = await db
    .from("orders")
    .select("number,email,status")
    .eq("id", id)
    .single();
  if (lookup) return { message: lookup.message, fields };
  const { error } = await db.from("orders").update({ status }).eq("id", id);
  if (error) return { message: error.message, fields };
  if (note) {
    const r = await db
      .from("order_notes")
      .insert({ order_id: id, body: note, customer_visible: visible });
    if (r.error) return { message: r.error.message, fields };
    if (visible) {
      const sent = await sendEmail({
        to: before.email,
        subject: `Battery Factory order #${before.number} update`,
        heading: `Order #${before.number}`,
        paragraphs: [note],
      });
      if (!sent.ok) return { message: "Saved, but the customer email failed." };
    }
  }
  if (status === "completed" && before.status !== "completed") {
    const sent = await sendEmail({
      to: before.email,
      subject: `Battery Factory order #${before.number} completed`,
      heading: "Your order is complete",
      paragraphs: [
        `Order #${before.number} has been completed. Thank you for shopping with Battery Factory.`,
      ],
      idempotencyKey: `order-${id}-completed`,
    });
    if (!sent.ok) return { message: "Saved, but the completion email failed." };
  }
  revalidatePath(`/admin/orders/${id}/`);
  revalidatePath("/admin/orders/");
  return {
    message:
      "Saved. Status changes do not issue a Stripe refund; handle refunds in Stripe.",
  };
}

// Deletes every Stripe test-mode order and checkout, restoring their stock.
// Live orders are never touched (enforced in SQL).
export async function purgeTestOrders(): Promise<{ message: string }> {
  await assertAdmin("orders");
  const db = createAdminClient();
  if (!db) return { message: "The server is missing its Supabase secret key." };
  const { data, error } = await db.rpc("purge_test_shop_checkouts");
  if (error) return { message: error.message };
  revalidatePath("/admin/orders/");
  return { message: `Deleted ${data} test order${data === 1 ? "" : "s"}.` };
}
