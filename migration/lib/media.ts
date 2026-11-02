// Media registry for the import. Steps ask for a file by WordPress attachment
// id or uploads URL and get back its future media id and public URL straight
// away; `flush()` later extracts, compresses (WebP) and uploads only those files.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Wp } from "./wp.ts";

const MAX_EDGE = 2000;
const WEBP_QUALITY = 75;
const CONVERT = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
]);
const MIME: Record<string, string> = {
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

export type MediaRef = { id: string; path: string; url: string };

type Entry = MediaRef & { source: string; wpId: number | null; alt: string };

// Stable UUID from the storage path, so re-runs keep the same media ids.
function uuidFor(key: string): string {
  const h = createHash("sha1").update(`bf-media:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((Number.parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const SIZE_SUFFIX = /-\d+x\d+(?=\.\w+$)/;
const SCALED_SUFFIX = /-(scaled|rotated)(?=\.\w+$)/;

export class MediaRegistry {
  private files = new Map<string, number>(); // path inside uploads/ -> bytes
  private byKey = new Map<string, Entry>();
  private taken = new Map<string, string>(); // storage path -> key
  private attachmentPaths = new Map<string, string>();
  private attachmentAlt = new Map<string, string>();
  readonly missing = new Set<string>();

  private zipPath: string;
  private workDir: string;
  private publicBase: string;

  constructor(wp: Wp, zipPath: string, workDir: string, publicBase: string) {
    this.zipPath = zipPath;
    this.workDir = workDir;
    this.publicBase = publicBase;
    const listing = execFileSync("zipinfo", ["-l", zipPath], {
      maxBuffer: 1 << 28,
    }).toString();
    for (const line of listing.split("\n")) {
      const m = /^-\S+\s+\S+\s+\S+\s+(\d+)\s+.*?\s(uploads\/.+)$/.exec(line);
      if (m) this.files.set(m[2].slice("uploads/".length), Number(m[1]));
    }
    for (const r of wp.all(
      "select post_id, meta_key, meta_value from wp_postmeta where meta_key in ('_wp_attached_file', '_wp_attachment_image_alt')",
    )) {
      if (r.meta_key === "_wp_attached_file")
        this.attachmentPaths.set(r.post_id!, r.meta_value!);
      else this.attachmentAlt.set(r.post_id!, r.meta_value ?? "");
    }
  }

  get zipBytes(): number {
    let total = 0;
    for (const size of this.files.values()) total += size;
    return total;
  }

  // Finds the source file for an uploads-relative path, ignoring WP size variants.
  private resolve(rel: string): { key: string; source: string } | null {
    rel = decodeURIComponent(rel.replace(/^\/+/, "").split(/[?#]/)[0]);
    const base = rel.replace(SIZE_SUFFIX, "").replace(SCALED_SUFFIX, "");
    const scaled = base.replace(/(\.\w+)$/, "-scaled$1");
    for (const candidate of [scaled, base, rel]) {
      if (this.files.has(candidate)) return { key: base, source: candidate };
    }
    return null;
  }

  private register(
    rel: string,
    wpId: number | null,
    alt = "",
  ): MediaRef | null {
    const found = this.resolve(rel);
    if (!found) {
      this.missing.add(rel);
      return null;
    }
    const existing = this.byKey.get(found.key);
    if (existing) {
      if (wpId && !existing.wpId) existing.wpId = wpId;
      if (alt && !existing.alt) existing.alt = alt;
      return existing;
    }
    const ext = path.extname(found.key).slice(1).toLowerCase();
    let dest = CONVERT.has(ext)
      ? found.key.replace(/\.\w+$/, ".webp")
      : found.key;
    if (this.taken.has(dest)) dest = dest.replace(/(\.\w+)$/, `-${ext}$1`);
    // Formidable uploads live under formidable/<form>/; keep them apart from the library.
    dest = `wp/${dest}`;
    this.taken.set(dest, found.key);
    const entry: Entry = {
      id: uuidFor(dest),
      path: dest,
      url: `${this.publicBase}/${dest.split("/").map(encodeURIComponent).join("/")}`,
      source: found.source,
      wpId,
      alt,
    };
    this.byKey.set(found.key, entry);
    return entry;
  }

  byAttachment(id: string | number | null | undefined): MediaRef | null {
    if (id == null || id === "" || id === "0") return null;
    const rel = this.attachmentPaths.get(String(id));
    if (!rel) {
      this.missing.add(`attachment #${id}`);
      return null;
    }
    return this.register(
      rel,
      Number(id),
      this.attachmentAlt.get(String(id)) ?? "",
    );
  }

  // Accepts a full URL, "/wp-content/uploads/..." or an uploads-relative path.
  byUrl(url: string): MediaRef | null {
    const m = /wp-content\/uploads\/(.+)$/.exec(url);
    return this.register(m ? m[1] : url, null);
  }

  get entries(): Entry[] {
    return [...this.byKey.values()];
  }

  sourceBytes(): number {
    return this.entries.reduce(
      (sum, e) => sum + (this.files.get(e.source) ?? 0),
      0,
    );
  }

  // Extracts the needed originals from the zip into the work dir (cached).
  extract(): void {
    const todo = this.entries.filter(
      (e) => !existsSync(path.join(this.workDir, "uploads", e.source)),
    );
    mkdirSync(this.workDir, { recursive: true });
    for (let i = 0; i < todo.length; i += 200) {
      const names = todo.slice(i, i + 200).map((e) => `uploads/${e.source}`);
      execFileSync("unzip", [
        "-qq",
        "-o",
        this.zipPath,
        ...names,
        "-d",
        this.workDir,
      ]);
    }
  }

  // Converts one entry; returns the bytes to upload plus its metadata.
  async convert(entry: Entry) {
    const file = path.join(this.workDir, "uploads", entry.source);
    const ext = path.extname(entry.path).slice(1).toLowerCase();
    if (
      ext !== "webp" ||
      !CONVERT.has(path.extname(entry.source).slice(1).toLowerCase())
    ) {
      const body = readFileSync(file);
      const meta = ["gif", "svg", "avif"].includes(ext)
        ? await sharp(body)
            .metadata()
            .catch(() => null)
        : null;
      return {
        body,
        mime: MIME[ext] ?? "application/octet-stream",
        width: meta?.width ?? null,
        height: meta?.height ?? null,
        originalBytes: statSync(file).size,
      };
    }
    const { data, info } = await sharp(file, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    return {
      body: data,
      mime: "image/webp",
      width: info.width,
      height: info.height,
      originalBytes: statSync(file).size,
    };
  }
}
