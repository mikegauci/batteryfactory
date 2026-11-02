"use server";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { assertAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath, updateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
const bulkTables = ["pages", "products"] as const;
async function bulkUpdateWork(form: FormData) {
  await assertAdmin();
  const table = String(form.get("table"));
  const status = String(form.get("status"));
  const ids = form.getAll("ids").map(String);
  if (
    !bulkTables.includes(table as (typeof bulkTables)[number]) ||
    !["draft", "published"].includes(status) ||
    !ids.length ||
    ids.length > 100 ||
    ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
  )
    throw Error("Select up to 100 records and a valid status.");
  const db = await createClient();
  const { error } = await db.rpc("admin_bulk_status", {
    target_table: table,
    target_ids: ids,
    new_status: status as "draft" | "published",
  });
  if (error) throw error;
  for (const tag of [table, "products"]) updateTag(tag);
  revalidatePath("/admin", "layout");
  return;
}
async function restoreRevisionWork(form: FormData) {
  await assertAdmin();
  const db = await createClient();
  const { data, error } = await db
    .from("content_history")
    .select("*")
    .eq("id", String(form.get("id")))
    .single();
  if (error) throw error;
  if (
    data.operation !== "UPDATE" ||
    !data.before_data ||
    data.entity !== "pages"
  )
    throw Error("Only saved page content can be restored.");
  const old = data.before_data as Record<string, unknown>;
  const fields =
    data.entity === "pages"
      ? ["title", "content", "seo", "hero_media_id"]
      : [
          "title",
          "content",
          "seo",
          "hero_media_id",
          "featured_media_id",
          "subtitle",
          "excerpt",
        ];
  const row = Object.fromEntries(
    fields.filter((k) => k in old).map((k) => [k, old[k]]),
  );
  const result = await db
    .from("pages")
    .update(row as TablesUpdate<"pages">)
    .eq("id", data.record_key)
    .select("id")
    .single();
  if (result.error) throw result.error;
  updateTag("pages");
  revalidatePath("/admin", "layout");
  return;
}
async function saveRedirectWork(form: FormData) {
  await assertAdmin();
  const db = await createClient();
  const normal = (v: FormDataEntryValue | null) => {
    const p = String(v || "")
      .trim()
      .toLowerCase();
    if (
      !/^\/(?!\/)[a-z0-9/_-]*$/.test(p) ||
      p.startsWith("/admin") ||
      p.startsWith("/api")
    )
      throw Error("Use a public site path such as /old-page/.");
    return p.endsWith("/") ? p : p + "/";
  };
  const source = normal(form.get("source")),
    destination = normal(form.get("destination"));
  if (source === "/" || source === destination)
    throw Error("Choose different paths; the homepage cannot be redirected.");
  const { data, error } = await db
    .from("redirects")
    .select("source,destination");
  if (error) throw error;
  const rules = new Map(data.map((r) => [r.source, r.destination]));
  rules.set(source, destination);
  const seen = new Set([source]);
  let current = destination;
  while (rules.has(current)) {
    if (seen.has(current)) throw Error("This redirect would create a loop.");
    seen.add(current);
    current = rules.get(current)!;
  }
  const result = await db
    .from("redirects")
    .upsert(
      { source, destination, permanent: form.get("permanent") === "on" },
      { onConflict: "source" },
    );
  if (result.error) throw result.error;
  revalidatePath("/admin/tools/");
  return;
}
async function deleteRedirectWork(form: FormData) {
  await assertAdmin();
  const db = await createClient();
  const { error } = await db
    .from("redirects")
    .delete()
    .eq("id", String(form.get("id")));
  if (error) throw error;
  revalidatePath("/admin/redirects/");
}
async function saveSiteSettingsWork(form: FormData) {
  await assertAdmin();
  const fields = [
    "navigation",
    "footerText",
    "contactEmail",
    "phone",
    "Facebook",
    "YouTube",
    "Instagram",
    "LinkedIn",
  ];
  const value = Object.fromEntries(
    fields.map((k) => [
      k,
      String(form.get(k) || "")
        .trim()
        .slice(0, 2000),
    ]),
  );
  for (const k of ["Facebook", "YouTube", "Instagram", "LinkedIn"]) {
    if (value[k] && !/^https:\/\/[^\s]+$/.test(value[k]))
      throw Error("Social links must use https://.");
  }
  if (
    value.contactEmail &&
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.contactEmail)
  )
    throw Error("Enter a valid contact email.");
  const db = await createClient();
  if (
    value.navigation &&
    value.navigation.split("\n").some((line) => {
      const [label, href, ...rest] = line.split("|").map((s) => s.trim());
      return rest.length || !label || !/^\/(?!\/)[^\s]*$/.test(href);
    })
  )
    throw Error("Use one Label | /path/ navigation entry per line.");
  const { error } = await db.from("settings").upsert({ key: "site", value });
  if (error) throw error;
  updateTag("site-settings");
  revalidatePath("/", "layout");
  return;
}

export async function bulkUpdate(form: FormData) {
  try {
    return await bulkUpdateWork(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save this change.",
    };
  }
}

export async function restoreRevision(form: FormData) {
  try {
    return await restoreRevisionWork(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save this change.",
    };
  }
}

export async function saveRedirect(form: FormData) {
  try {
    return await saveRedirectWork(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save this change.",
    };
  }
}

export async function deleteRedirect(form: FormData) {
  try {
    return await deleteRedirectWork(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save this change.",
    };
  }
}

export async function saveSiteSettings(form: FormData) {
  try {
    return await saveSiteSettingsWork(form);
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Could not save this change.",
    };
  }
}
