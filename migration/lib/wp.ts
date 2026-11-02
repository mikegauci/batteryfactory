// Query helpers over the SQLite copy of the WordPress database.
import type { DatabaseSync } from "node:sqlite";

export type Row = Record<string, string | null>;

export class Wp {
  readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  all(sql: string, ...params: (string | number)[]): Row[] {
    // Columns are TEXT; JS numbers would bind as REAL ("4.0") and never match.
    return this.db.prepare(sql).all(...params.map(String)) as Row[];
  }

  get(sql: string, ...params: (string | number)[]): Row | undefined {
    return this.db.prepare(sql).get(...params.map(String)) as Row | undefined;
  }

  // All meta for a set of posts: Map<postId, Map<key, value>>.
  postMeta(postIds: string[]): Map<string, Map<string, string>> {
    const out = new Map<string, Map<string, string>>();
    if (!postIds.length) return out;
    const rows = this.all(
      `select post_id, meta_key, meta_value from wp_postmeta where post_id in (${postIds.map(() => "?").join(",")})`,
      ...postIds,
    );
    for (const r of rows) {
      const id = r.post_id!;
      if (!out.has(id)) out.set(id, new Map());
      out.get(id)!.set(r.meta_key!, r.meta_value ?? "");
    }
    return out;
  }

  userMeta(userId: string): Map<string, string> {
    const rows = this.all(
      "select meta_key, meta_value from wp_usermeta where user_id = ?",
      userId,
    );
    return new Map(rows.map((r) => [r.meta_key!, r.meta_value ?? ""]));
  }

  // Formidable entries of a form, with their field values keyed by field id.
  frmEntries(formId: number): { item: Row; values: Map<string, string> }[] {
    const items = this.all(
      "select * from wp_frm_items where form_id = ? and is_draft = '0' order by cast(id as integer)",
      String(formId),
    );
    const metas = this.all(
      "select m.item_id, m.field_id, m.meta_value from wp_frm_item_metas m join wp_frm_items i on i.id = m.item_id where i.form_id = ?",
      String(formId),
    );
    const byItem = new Map<string, Map<string, string>>();
    for (const m of metas) {
      if (!byItem.has(m.item_id!)) byItem.set(m.item_id!, new Map());
      byItem.get(m.item_id!)!.set(m.field_id!, m.meta_value ?? "");
    }
    return items.map((item) => ({
      item,
      values: byItem.get(item.id!) ?? new Map(),
    }));
  }

  // Terms attached to an object for a taxonomy.
  termsFor(objectId: string, taxonomy: string): Row[] {
    return this.all(
      `select t.term_id, t.name, t.slug, tt.description from wp_term_relationships r
       join wp_term_taxonomy tt on tt.term_taxonomy_id = r.term_taxonomy_id
       join wp_terms t on t.term_id = tt.term_id
       where r.object_id = ? and tt.taxonomy = ?`,
      objectId,
      taxonomy,
    );
  }
}

// WordPress stores dates as local Malta time ("2023-04-29 10:00:00") plus a GMT copy.
export function wpDate(
  gmt: string | null,
  local?: string | null,
): string | null {
  const value = gmt && !gmt.startsWith("0000") ? gmt : local;
  if (!value || value.startsWith("0000")) return null;
  return gmt && !gmt.startsWith("0000")
    ? `${value.replace(" ", "T")}Z`
    : new Date(`${value.replace(" ", "T")}+01:00`).toISOString();
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
