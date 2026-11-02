"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/admin";
import { removeStripeKey, repairWebhook, saveStripeKey } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const NO_DB = { error: "Payments are not configured on the server." };

export async function saveKey(form: FormData) {
  const user = await assertAdmin();
  const db = createAdminClient();
  if (!db) return NO_DB;
  const result = await saveStripeKey(
    db,
    String(form.get("secret_key") ?? ""),
    user.id,
  );
  if (result) return result;
  revalidatePath("/admin/payments/");
}

export async function fixWebhook() {
  await assertAdmin();
  const db = createAdminClient();
  if (!db) return NO_DB;
  const result = await repairWebhook(db);
  if (result) return result;
  revalidatePath("/admin/payments/");
}

export async function removeKey() {
  await assertAdmin();
  const db = createAdminClient();
  if (!db) return NO_DB;
  await removeStripeKey(db);
  revalidatePath("/admin/payments/");
}
