import { ActionForm } from "@/components/admin/action-form";
import { brokenInternalLinks } from "@/lib/admin/content-checks";
import { RESERVED_SLUGS } from "@/lib/slug";
import { SelectAll } from "@/components/admin/select-all";
import { ProductReport } from "@/components/admin/product-report";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  inventory,
  mediaReferenceIndex,
  findMediaUsage,
} from "@/lib/admin/inventory";
import { bulkUpdate, restoreRevision, saveSiteSettings } from "./actions";
import { formatPrice } from "@/lib/format";
const input = "rounded border border-black/20 bg-white p-2 text-sm";
const sections = ["history", "bulk", "seo", "media", "reports", "settings"];
export const metadata = { title: "CMS tools" };
export default async function Tools({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const view = sections.includes(params.view || "") ? params.view! : "history";
  const db = await createClient();
  let body: React.ReactNode;
  if (view === "history") {
    let query = db
      .from("content_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (params.record) query = query.eq("record_key", params.record);
    const { data, error } = await query;
    if (error) throw error;
    body = (
      <>
        <p className="mb-4 text-sm">
          Latest 100 changes. Restoring a version keeps its current URL and
          publishing status, and creates another history entry.
        </p>
        <ul className="divide-y">
          {data.map((h) => (
            <li key={h.id} className="py-4">
              <p className="font-bold">
                {h.operation} · {h.entity} ·{" "}
                {String(
                  (h.after_data as Record<string, unknown>)?.title ||
                    (h.after_data as Record<string, unknown>)?.name ||
                    h.record_key,
                )}
              </p>
              <p className="text-muted text-xs">
                {new Date(h.created_at).toLocaleString("en-MT", {
                  timeZone: "Europe/Malta",
                })}{" "}
                · {h.actor_id ?? "System / import"}
              </p>
              <details>
                <summary className="cursor-pointer text-sm underline">
                  View changes
                </summary>
                <pre className="max-h-80 overflow-auto text-xs">
                  {JSON.stringify(
                    { before: h.before_data, after: h.after_data },
                    null,
                    2,
                  )}
                </pre>
              </details>
              {h.operation === "UPDATE" &&
                h.before_data &&
                h.entity === "pages" && (
                  <ActionForm action={restoreRevision}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="mt-2 rounded border px-3 py-1 text-sm">
                      Restore this earlier content
                    </button>
                  </ActionForm>
                )}
            </li>
          ))}
        </ul>
        {!data.length && (
          <p>
            No changes recorded yet. History starts when this upgrade was
            installed.
          </p>
        )}
      </>
    );
  } else if (view === "settings") {
    const { data, error } = await db
      .from("settings")
      .select("value")
      .eq("key", "site")
      .maybeSingle();
    if (error) throw error;
    const settings = (data?.value ?? {}) as Record<string, string>;
    body = (
      <ActionForm action={saveSiteSettings} className="max-w-2xl space-y-4">
        {[
          "navigation",
          "footerText",
          "contactEmail",
          "phone",
          "Facebook",
          "YouTube",
          "Instagram",
          "LinkedIn",
        ].map((key) => (
          <label key={key} className="block text-sm">
            {key}
            <textarea
              rows={key === "navigation" ? 8 : 2}
              aria-label={key}
              placeholder={
                key === "navigation" ? "Home | /\nShop | /shop/" : undefined
              }
              className={`${input} mt-1 block w-full`}
              name={key}
              defaultValue={settings[key] ?? ""}
            />
          </label>
        ))}
        <button className="shop-button">Save site settings</button>
      </ActionForm>
    );
  } else if (view === "reports") {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from("orders")
        .select("created_at,status,total_cents,currency")
        .eq("livemode", true)
        .order("id")
        .range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    const from = params.from || "",
      to = params.to || "";
    const paid = rows.filter(
      (r) =>
        ["processing", "completed"].includes(r.status) &&
        r.currency.toUpperCase() === "EUR" &&
        (!from || r.created_at.slice(0, 10) >= from) &&
        (!to || r.created_at.slice(0, 10) <= to),
    );
    const total = paid.reduce((s, r) => s + r.total_cents, 0);
    const months = new Map<string, { total: number; count: number }>();
    for (const r of paid) {
      const month = r.created_at.slice(0, 7);
      const m = months.get(month) || { total: 0, count: 0 };
      m.total += r.total_cents;
      m.count++;
      months.set(month, m);
    }
    body = (
      <>
        <form className="mb-5 flex flex-wrap gap-3">
          <input type="hidden" name="view" value="reports" />
          <label>
            From (UTC){" "}
            <input
              type="date"
              name="from"
              defaultValue={from}
              className={input}
            />
          </label>
          <label>
            To (UTC){" "}
            <input type="date" name="to" defaultValue={to} className={input} />
          </label>
          <button className="shop-button">Apply</button>
          <Link href="/admin/tools/?view=reports" className="p-2 underline">
            Lifetime
          </Link>
        </form>
        <p className="mb-5 text-lg">
          Revenue {formatPrice(total)} · {paid.length} paid orders · Average{" "}
          {formatPrice(paid.length ? Math.round(total / paid.length) : 0)}
        </p>
        <p className="mb-4 text-sm">
          Live EUR processing/completed orders by order date, including tax and
          shipping. Refunded/cancelled orders excluded.
        </p>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Month (UTC)</th>
              <th>Orders</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {[...months]
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([month, m]) => (
                <tr key={month}>
                  <td className="py-2">{month}</td>
                  <td>{m.count}</td>
                  <td>{formatPrice(m.total)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <a
          className="mt-5 inline-block underline"
          href={`/admin/tools/export/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
        >
          Download CSV
        </a>
        <ProductReport from={from} to={to} />
      </>
    );
  } else if (view === "bulk") {
    const tables = ["pages", "products"] as const;
    const table = tables.find((t) => t === params.table) || "pages";
    const requested = Number(params.page);
    const page =
      Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
    const search = (params.q || "").slice(0, 200);
    let query = db
      .from(table)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 100, page * 100 - 1);
    if (search)
      query =
        table === "products"
          ? query.ilike("name", `%${search}%`)
          : query.ilike("title", `%${search}%`);
    const { data, error, count } = await query;
    const pageHref = (n: number) =>
      `?${new URLSearchParams({ view: "bulk", table, q: search, page: String(n) })}`;
    if (error) throw error;
    body = (
      <>
        <nav className="mb-4 flex flex-wrap gap-3">
          {tables.map((t) => (
            <Link key={t} className="underline" href={`?view=bulk&table=${t}`}>
              {t}
            </Link>
          ))}
        </nav>
        <form className="mb-4 flex gap-3">
          <input type="hidden" name="view" value="bulk" />
          <input type="hidden" name="table" value={table} />
          <input
            name="q"
            aria-label="Search content"
            placeholder="Search names or titles"
            defaultValue={search}
            className={input}
          />
          <button className="shop-button">Search</button>
        </form>
        <ActionForm action={bulkUpdate}>
          <input type="hidden" name="table" value={table} />
          <div className="mb-4 flex gap-3">
            <select name="status" className={input}>
              <option value="draft">Hide / move to draft</option>
              <option value="published">Publish</option>
            </select>
            <button className="shop-button">Apply to selected</button>
          </div>
          <p className="mb-3 text-sm">
            Showing page {page} · {count ?? 0} matching records. Select up to
            100 records.
          </p>
          <SelectAll />
          {data.map((row) => (
            <label className="flex gap-3 border-t py-3" key={row.id}>
              <input type="checkbox" name="ids" value={row.id} />
              <span>
                {"title" in row ? row.title : row.name}{" "}
                <span className="text-muted text-xs">{row.status}</span>
              </span>
            </label>
          ))}
        </ActionForm>
        <nav aria-label="Bulk content pages" className="mt-5 flex gap-5">
          {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
          {page * 100 < (count ?? 0) && (
            <Link href={pageHref(page + 1)}>Next →</Link>
          )}
        </nav>
      </>
    );
  } else {
    const groups = await inventory();
    const known = new Set([
      "/",
      ...Array.from(RESERVED_SLUGS).map((slug) => `/${slug}`),
    ]);
    for (const { table, rows } of groups)
      for (const row of rows) {
        if (row.status !== "published") continue;
        const slug = table === "pages" ? row.path : row.slug;
        if (!slug) continue;
        const prefix = table === "products" ? "/product/" : "/";
        known.add(prefix + slug);
      }
    const redirects = await db.from("redirects").select("source");
    if (redirects.error) throw redirects.error;
    for (const rule of redirects.data)
      known.add(rule.source.replace(/\/+$/, "") || "/");
    const issues: { label: string; href: string; reason: string }[] = [];
    for (const { table, rows } of groups)
      for (const row of rows) {
        const reasons: string[] = [];
        const label = String(row.title || row.name || row.id);
        const section = table;
        if (view === "seo") {
          const seo = (row.seo ?? {}) as Record<string, unknown>;
          const broken = brokenInternalLinks(
            String(row.content || row.description || ""),
            known,
          );
          if (broken.length)
            reasons.push(`Unknown internal links: ${broken.join(", ")}`);
          if (!seo.title) reasons.push("Missing SEO title");
          if (!seo.description) reasons.push("Missing SEO description");
          if (String(seo.title || "").length > 60)
            reasons.push("SEO title over 60 characters");
          if (String(seo.description || "").length > 160)
            reasons.push("Description over 160 characters");
        }
        if (view !== "media" && reasons.length)
          issues.push({
            label,
            reason: reasons.join(" · "),
            href: `/admin/${section}/${row.id}/`,
          });
      }
    if (view === "media") {
      const data = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await db
          .from("media")
          .select("id,path,file_name,alt,mime_type,size_bytes")
          .order("id")
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        data.push(...result.data);
        if (result.data.length < 1000) break;
      }
      const references = await mediaReferenceIndex(groups);
      for (const m of data) {
        const reasons = [];
        if (!findMediaUsage(references, m.id, m.path).length)
          reasons.push("No CMS or known layout references");
        if (m.mime_type.startsWith("image/") && !m.alt)
          reasons.push("Missing alt text");
        if (m.size_bytes > 1024 * 1024) reasons.push("Over 1 MB");
        if (reasons.length)
          issues.push({
            label: m.file_name,
            reason: reasons.join(" · "),
            href: `/admin/tools/media/${m.id}/`,
          });
      }
    }
    body = (
      <>
        <p className="mb-4 text-sm">
          {issues.length} records need attention. Checks report stored metadata;
          they do not crawl external websites.
        </p>
        <ul className="divide-y">
          {issues.map((i, n) => (
            <li key={n} className="py-3">
              <Link href={i.href} className="font-semibold underline">
                {i.label}
              </Link>
              <p className="text-muted text-sm">{i.reason}</p>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <AdminPageHeader title="CMS tools" />
      <nav className="mb-6 flex flex-wrap gap-3">
        {sections.map((s) => (
          <Link
            key={s}
            href={`?view=${s}`}
            className={`rounded px-3 py-2 text-sm capitalize ${view === s ? "bg-ink text-white" : "bg-white"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      {params.saved && (
        <p role="status" className="mb-4 text-green-700">
          Saved successfully.
        </p>
      )}
      <section className="rounded-lg bg-white p-5">{body}</section>
    </>
  );
}
