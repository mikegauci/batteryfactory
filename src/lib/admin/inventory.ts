import { staticMediaPaths } from "@/lib/media-static-references";
import "server-only";
import { createClient } from "@/lib/supabase/server";
export const contentTables = ["pages", "products"] as const;
export async function inventory() {
  const db = await createClient();
  const groups = await Promise.all(
    contentTables.map(async (table) => {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      return { table, rows };
    }),
  );
  return groups;
}
export async function mediaUsage(id: string, path: string) {
  return findMediaUsage(await mediaReferenceIndex(await inventory()), id, path);
}

export async function mediaReferenceIndex(
  groups: Awaited<ReturnType<typeof inventory>>,
) {
  const references = groups.flatMap(({ table, rows }) =>
    rows.map((row) => ({
      label: `${table}: ${row.title || row.name || row.id}`,
      text: JSON.stringify(row),
    })),
  );
  const db = await createClient();
  for (const table of [
    "product_categories",
    "product_variants",
    "product_media",
    "settings",
  ] as const) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .range(offset, offset + 999);
      if (error) throw error;
      for (const row of data)
        references.push({ label: table, text: JSON.stringify(row) });
      if (data.length < 1000) break;
    }
  }
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("content_history")
      .select("id,entity,before_data")
      .in("entity", ["pages", "products"])
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const row of data)
      references.push({
        label: `Saved revision (${row.entity})`,
        text: JSON.stringify(row.before_data),
      });
    if (data.length < 1000) break;
  }
  return references;
}
export function findMediaUsage(
  references: { label: string; text: string }[],
  id: string,
  path: string,
) {
  return [
    ...new Set([
      ...(staticMediaPaths.includes(path) ? ["Website layout asset"] : []),
      ...references
        .filter(
          (r) =>
            r.text.includes(id) ||
            r.text.includes(path) ||
            r.text.includes(encodeURI(path)),
        )
        .map((r) => r.label),
    ]),
  ];
}
