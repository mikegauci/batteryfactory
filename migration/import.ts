// WordPress -> Supabase import. Re-runnable: every row and file has a stable
// id, so running it again updates in place (used for the final sync).
//
//   pnpm migrate            dry run: reads the export, converts images, prints a report
//   pnpm migrate --apply    uploads media and writes everything to Supabase
//
// Needs NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SECRET_KEY for --apply (.env or .env.local).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types.ts";
import { Context } from "./lib/context.ts";
import { loadDump } from "./lib/dump.ts";
import { MediaRegistry } from "./lib/media.ts";
import { Wp } from "./lib/wp.ts";
import { importShop } from "./steps/shop.ts";
import { importSite } from "./steps/site.ts";
import { importUsers } from "./steps/users.ts";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const EXPORTS = path.join(ROOT, "exports");
const CACHE = path.join(ROOT, ".cache");
const BUCKET = "media";
const STORAGE_LIMIT = 1024 ** 3; // Supabase free plan: 1 GB

const apply = process.argv.includes("--apply");
const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

function findExport(pattern: RegExp): string {
  const file = readdirSync(EXPORTS).find((f) => pattern.test(f));
  if (!file)
    throw new Error(`No file matching ${pattern} in migration/exports/`);
  return path.join(EXPORTS, file);
}

async function pool<T>(
  items: T[],
  size: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (apply && !key)
    throw new Error(
      "SUPABASE_SECRET_KEY is required for --apply (add it to .env.local)",
    );
  const db = key
    ? createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  console.log("Reading the WordPress export…");
  const wp = new Wp(
    await loadDump(findExport(/\.sql(\.gz)?$/), path.join(CACHE, "wp.sqlite")),
  );
  const media = new MediaRegistry(
    wp,
    findExport(/uploads.*\.zip$/),
    CACHE,
    `${url}/storage/v1/object/public/${BUCKET}`,
  );
  const ctx = new Context(wp, media, db);

  const users = await importUsers(ctx);
  importShop(ctx, users);
  importSite(ctx);

  // Media: extract only the referenced files, convert, measure.
  const entries = media.entries;
  console.log(`Converting ${entries.length} media files…`);
  media.extract();
  const outDir = path.join(CACHE, "converted");
  let converted = 0;
  let originalTotal = 0;
  const failed: string[] = [];
  const rows: Database["public"]["Tables"]["media"]["Insert"][] = [];
  await pool(entries, 4, async (entry, i) => {
    try {
      const out = path.join(outDir, entry.path);
      const metaFile = `${out}.json`;
      let info: {
        mime: string;
        width: number | null;
        height: number | null;
        size: number;
        originalBytes: number;
      };
      if (existsSync(metaFile)) {
        info = JSON.parse(readFileSync(metaFile, "utf8"));
      } else {
        const result = await media.convert(entry);
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, result.body);
        info = {
          mime: result.mime,
          width: result.width,
          height: result.height,
          size: result.body.length,
          originalBytes: result.originalBytes,
        };
        writeFileSync(metaFile, JSON.stringify(info));
      }
      converted += info.size;
      originalTotal += info.originalBytes;
      rows.push({
        id: entry.id,
        wp_id: entry.wpId,
        path: entry.path,
        file_name: path.basename(entry.path),
        mime_type: info.mime,
        size_bytes: info.size,
        width: info.width,
        height: info.height,
        alt: entry.alt,
      });
    } catch (error) {
      failed.push(`${entry.source}: ${(error as Error).message}`);
    }
    if ((i + 1) % 200 === 0) console.log(`  ${i + 1}/${entries.length}`);
  });
  for (const f of failed) ctx.warn(`media: could not convert ${f}`);
  for (const m of media.missing)
    ctx.warn(`media: referenced but not in the uploads zip: ${m}`);

  ctx.count("media: files in uploads.zip", mb(media.zipBytes));
  ctx.count("media: referenced files", entries.length);
  ctx.count("media: referenced originals", mb(originalTotal));
  ctx.count("media: after compression", mb(converted));
  ctx.count(
    "media: share of the 1 GB free storage",
    `${((converted / STORAGE_LIMIT) * 100).toFixed(1)}%`,
  );

  if (apply && db) {
    if (converted > STORAGE_LIMIT * 0.9)
      throw new Error(
        "Media would use over 90% of the 1 GB storage; stopping.",
      );
    console.log("Uploading media…");
    const { data: existing } = await db
      .from("media")
      .select("id, size_bytes")
      .in(
        "id",
        rows.map((r) => r.id!),
      );
    const done = new Map((existing ?? []).map((r) => [r.id, r.size_bytes]));
    const toUpload = rows.filter((r) => done.get(r.id!) !== r.size_bytes);
    // Free-plan Storage rate-limits bursts, so upload two at a time and
    // retry with backoff. Each file's media row is saved right after its
    // upload, so an interrupted run resumes where it stopped.
    await pool(toUpload, 2, async (row, i) => {
      const body = readFileSync(path.join(outDir, row.path));
      for (let attempt = 1; ; attempt++) {
        const { error } = await db.storage.from(BUCKET).upload(row.path, body, {
          contentType: row.mime_type,
          cacheControl: "31536000",
          upsert: true,
        });
        const saved = error
          ? { error }
          : await db.from("media").upsert(row, { onConflict: "id" });
        if (!saved.error) break;
        if (attempt === 6)
          throw new Error(`upload ${row.path}: ${saved.error.message}`);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${toUpload.length}`);
    });

    console.log("Writing content…");
    for (const write of ctx.writes) {
      if (!write.label.startsWith("user ")) console.log(`  ${write.label}`);
      await write.run(db);
    }
  }

  const lines = [
    `# Import ${apply ? "result" : "dry run"} (${new Date().toISOString()})`,
    "",
    "| | |",
    "|---|---|",
    ...[...ctx.report].map(([k, v]) => `| ${k} | ${v} |`),
    "",
    `## Warnings (${ctx.warnings.length})`,
    "",
    ...ctx.warnings.map((w) => `- ${w}`),
  ];
  writeFileSync(path.join(CACHE, "report.md"), `${lines.join("\n")}\n`);
  console.log(`\n${lines.join("\n")}`);
  console.log(
    `\nReport saved to migration/.cache/report.md${apply ? "" : "\nDry run only: nothing was written. Run with --apply to import."}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
