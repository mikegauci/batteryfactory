// Shared state for one import run: the WordPress DB, the media registry, the
// Supabase admin client and a queue of writes that run after media uploads.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types.ts";
import type { MediaRegistry } from "./media.ts";
import type { Wp } from "./wp.ts";

export type Admin = SupabaseClient<Database>;
type Write = { label: string; run: (db: Admin) => Promise<void> };

export class Context {
  readonly writes: Write[] = [];
  readonly report = new Map<string, number | string>();
  readonly warnings: string[] = [];

  readonly wp: Wp;
  readonly media: MediaRegistry;
  readonly db: Admin | null;

  constructor(wp: Wp, media: MediaRegistry, db: Admin | null) {
    this.wp = wp;
    this.media = media;
    this.db = db;
  }

  count(label: string, value: number | string) {
    this.report.set(label, value);
  }

  warn(message: string) {
    this.warnings.push(message);
  }

  // Stable row id from table + WordPress id, so re-runs update the same rows.
  id(table: string, wpId: string | number): string {
    const h = createHash("sha1").update(`bf:${table}:${wpId}`).digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((Number.parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }

  // Queues an upsert of `rows` into `table`, in chunks.
  upsert<T extends keyof Database["public"]["Tables"]>(
    table: T,
    rows: Database["public"]["Tables"][T]["Insert"][],
    onConflict: string,
  ) {
    if (!rows.length) return;
    // Drop duplicates on the conflict key (Postgres rejects them in one statement).
    const keys = onConflict.split(",");
    const unique = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      unique.set(keys.map((k) => String(r[k])).join("|"), row);
    }
    rows = [...unique.values()];
    this.writes.push({
      label: `${String(table)} (${rows.length})`,
      run: async (db) => {
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await db
            .from(table)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(rows.slice(i, i + 200) as any, {
              onConflict,
              ignoreDuplicates: false,
            });
          if (error) throw new Error(`${String(table)}: ${error.message}`);
        }
      },
    });
  }

  queue(label: string, run: (db: Admin) => Promise<void>) {
    this.writes.push({ label, run });
  }

  // Rewrites WordPress HTML: drops block comments, moves uploads to Storage
  // URLs (registering each file) and makes batteryfactory.mt links relative.
  html(input: string | null | undefined): string {
    if (!input) return "";
    let out = input.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, "");
    out = out.replace(/\s(srcset|sizes)="[^"]*"/g, "");
    out = out.replace(
      /(?:https?:)?\/\/(?:www\.)?batteryfactory\.mt\/wp-content\/uploads\/([^"'\s)<>]+)/g,
      (match, rel: string) => this.media.byUrl(rel)?.url ?? match,
    );
    out = out.replace(
      /https?:\/\/(?:www\.)?batteryfactory\.mt(\/[^"'\s<>]*)?/g,
      (_m, p?: string) => p || "/",
    );
    return out.replace(/\n{3,}/g, "\n\n").trim();
  }
}
