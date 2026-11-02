// WooCommerce customers -> Supabase Auth users + profiles. Accounts are created
// confirmed and without a password: people set one with "Lost your password?".
// WordPress admins and editors are not imported (CMS access is managed in
// /admin/users/).
import type { Context } from "../lib/context.ts";

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "postcode",
  "country",
  "phone",
] as const;

function address(meta: Map<string, string>, prefix: "billing" | "shipping") {
  const out: Record<string, string> = {};
  for (const field of ADDRESS_FIELDS) {
    const value = meta.get(`${prefix}_${field}`)?.trim();
    if (value) out[field] = value;
  }
  return out;
}

// Maps WordPress user id -> profile id, for the other steps.
export async function importUsers(ctx: Context): Promise<Map<string, string>> {
  const users = ctx.wp
    .all("select * from wp_users order by cast(ID as integer)")
    .filter((u) =>
      /"customer"/.test(ctx.wp.userMeta(u.ID!).get("wp_capabilities") ?? ""),
    );

  // Existing Supabase accounts (e.g. the admin who registered on the new site).
  const existing = new Map<string, string>();
  if (ctx.db) {
    for (let page = 1; ; page++) {
      const { data, error } = await ctx.db.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw error;
      for (const u of data.users)
        if (u.email) existing.set(u.email.toLowerCase(), u.id);
      if (data.users.length < 1000) break;
    }
  }

  const map = new Map<string, string>();
  let created = 0;
  let linked = 0;
  for (const u of users) {
    const email = u.user_email!.trim().toLowerCase();
    if (!email) continue;
    const meta = ctx.wp.userMeta(u.ID!);
    const known = existing.get(email);
    const id = known ?? ctx.id("users", u.ID!);
    map.set(u.ID!, id);
    const firstName =
      meta.get("first_name") || meta.get("billing_first_name") || "";
    const lastName =
      meta.get("last_name") || meta.get("billing_last_name") || "";
    const profile = {
      wp_id: Number(u.ID),
      billing_address: address(meta, "billing"),
      shipping_address: address(meta, "shipping"),
    };

    if (known) linked++;
    else created++;

    ctx.queue(`user ${email}`, async (db) => {
      if (!known) {
        const { error } = await db.auth.admin.createUser({
          id,
          email,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            username: u.user_login,
          },
        });
        if (
          error &&
          !/already been registered|already exists/i.test(error.message)
        ) {
          throw new Error(`createUser ${email}: ${error.message}`);
        }
      }
      // Signup runs the profile trigger; fill in the WooCommerce data afterwards.
      const { error } = await db
        .from("profiles")
        .update({
          ...profile,
          created_at: new Date(
            `${u.user_registered!.replace(" ", "T")}Z`,
          ).toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(`profile ${email}: ${error.message}`);
    });
  }
  ctx.count("users: new accounts", created);
  ctx.count("users: linked to existing accounts", linked);
  return map;
}
