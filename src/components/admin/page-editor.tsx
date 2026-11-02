"use client";
import { useState, useTransition } from "react";
import { LocalDraft } from "@/components/admin/local-draft";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { savePage, type PageInput } from "@/app/(admin)/admin/pages/actions";
import { MediaField, type PickedMedia } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { PAGE_FIELDS } from "@/lib/page-fields";
import { PAGE_CONTENT_AREAS, pageContentMode } from "@/lib/page-content";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
const field =
  "mt-1 block w-full rounded border border-black/20 bg-white p-2 text-sm";
export function PageEditor({
  initial,
  hero: initialHero,
}: {
  initial: PageInput;
  hero: PickedMedia | null;
}) {
  const [page, setPage] = useState(initial);
  const [hero, setHero] = useState(initialHero);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const mode = initial.id ? pageContentMode(initial.path) : "page";
  const fixedStatus =
    initial.id &&
    ((RESERVED_SLUGS.has(initial.path) && initial.path !== "privacy-policy") ||
      initial.path === "");
  const update = (patch: Partial<PageInput>) => {
    setPage((p) => ({ ...p, ...patch }));
    setMessage("");
  };
  function save() {
    start(async () => {
      try {
        const result = await savePage({
          ...page,
          heroMediaId: hero?.id ?? null,
        });
        if ("error" in result) {
          setMessage(result.error);
          return;
        }
        setMessage("Page saved.");
        if (!page.id) router.replace(`/admin/pages/${result.id}/`);
        else router.refresh();
      } catch {
        setMessage("Could not save the page. Please try again.");
      }
    });
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <LocalDraft
          draftKey={`bf:page-editor.tsx:${initial.id || "new-page"}`}
          value={{ page, hero }}
          onRestore={(draft) => {
            setPage(draft.page);
            setHero(draft.hero);
          }}
        />
        {initial.id && (
          <Link
            href={`/admin/tools/?view=history&record=${initial.id}`}
            className="block text-sm underline"
          >
            View version history
          </Link>
        )}
        <div className="space-y-4 rounded-lg bg-white p-5">
          <label className="block text-sm font-semibold">
            Title
            <input
              className={field}
              value={page.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Page URL
            <input
              className={field}
              value={
                page.id ? `/${page.path}${page.path ? "/" : ""}` : page.path
              }
              disabled={Boolean(page.id)}
              onChange={(e) => update({ path: e.target.value })}
              onBlur={() => update({ path: slugify(page.path) })}
              placeholder="about-us"
            />
          </label>
          {page.id && (
            <p className="text-muted text-xs">
              The URL is fixed to keep existing links working.
            </p>
          )}
        </div>
        {mode === "section" && PAGE_FIELDS[page.path] && (
          <div className="space-y-4 rounded-lg bg-white p-5">
            <h2 className="font-bold">Page text</h2>
            <p className="text-muted text-sm">
              Edit the original layout’s text here. Line breaks are preserved.
            </p>
            {Object.entries(PAGE_FIELDS[page.path]).map(([key, config]) => (
              <div key={key} className="block text-sm">
                {config.label}
                {config.kind === "select" ? (
                  <select
                    className={field}
                    aria-label={config.label}
                    value={page.contentFields?.[key] ?? config.value}
                    onChange={(e) =>
                      update({
                        contentFields: {
                          ...page.contentFields,
                          [key]: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                  </select>
                ) : config.kind === "image" ? (
                  <MediaField
                    label={config.label}
                    value={{
                      id: key,
                      path: page.contentFields?.[key] ?? config.value,
                      alt: "",
                      width: null,
                      height: null,
                    }}
                    onChange={(image) => {
                      if (image)
                        update({
                          contentFields: {
                            ...page.contentFields,
                            [key]: image.path,
                          },
                        });
                    }}
                  />
                ) : config.kind === "order" ? (
                  <div className="space-y-2">
                    {(page.contentFields?.[key] ?? config.value)
                      .split(",")
                      .map((name, index, order) => (
                        <div
                          key={name}
                          className="flex items-center gap-3 rounded border p-2"
                        >
                          <span className="flex-1 capitalize">
                            {name === "intro"
                              ? "Hero and featured stories"
                              : name}
                          </span>
                          {[-1, 1].map((by) => (
                            <button
                              key={by}
                              type="button"
                              disabled={
                                index + by < 0 || index + by >= order.length
                              }
                              className="rounded border px-3 disabled:opacity-30"
                              aria-label={`Move ${name} ${by < 0 ? "up" : "down"}`}
                              onClick={() => {
                                const next = [...order];
                                [next[index], next[index + by]] = [
                                  next[index + by],
                                  next[index],
                                ];
                                update({
                                  contentFields: {
                                    ...page.contentFields,
                                    [key]: next.join(","),
                                  },
                                });
                              }}
                            >
                              {by < 0 ? "↑" : "↓"}
                            </button>
                          ))}
                        </div>
                      ))}
                  </div>
                ) : (
                  <textarea
                    rows={2}
                    aria-label={config.label}
                    className={field}
                    value={page.contentFields?.[key] ?? config.value}
                    onChange={(e) =>
                      update({
                        contentFields: {
                          ...page.contentFields,
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {mode !== "seo" ? (
          <>
            {mode === "section" && (
              <div className="space-y-3 rounded-lg bg-white p-5 text-sm">
                <p>
                  <strong>Editable area:</strong>{" "}
                  {PAGE_CONTENT_AREAS[page.path]}. Dynamic tools and forms stay
                  in place.
                </p>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={page.managedContent}
                    onChange={(e) =>
                      update({ managedContent: e.target.checked })
                    }
                  />
                  Replace this area with custom rich text
                </label>
                <p className="text-muted">
                  When enabled, the title, header image and content below
                  replace this area’s original design. Imported content can be
                  edited as HTML. Disable to restore the original design.
                </p>
              </div>
            )}
            {(mode === "page" || page.managedContent) && (
              <RichTextEditor
                value={page.content}
                onChange={(content) => update({ content })}
              />
            )}
          </>
        ) : (
          <p className="rounded-lg bg-white p-5 text-sm">
            This is an account or checkout page. You can edit its SEO here; its
            forms and account content are managed by the app.
          </p>
        )}
        <div className="space-y-4 rounded-lg bg-white p-5">
          <h2 className="font-bold">SEO</h2>
          <label className="block text-sm">
            Browser title
            <input
              className={field}
              value={page.seo.title ?? ""}
              onChange={(e) =>
                update({ seo: { ...page.seo, title: e.target.value } })
              }
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              className={field}
              rows={3}
              value={page.seo.description ?? ""}
              onChange={(e) =>
                update({ seo: { ...page.seo, description: e.target.value } })
              }
            />
          </label>
          <label className="block text-sm">
            Canonical URL
            <input
              className={field}
              value={page.seo.canonical ?? ""}
              onChange={(e) =>
                update({ seo: { ...page.seo, canonical: e.target.value } })
              }
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(page.seo.noindex)}
              onChange={(e) =>
                update({ seo: { ...page.seo, noindex: e.target.checked } })
              }
            />
            Hide from search engines
          </label>
        </div>
      </div>
      <aside className="space-y-5 rounded-lg bg-white p-5">
        {!fixedStatus && (
          <label className="block text-sm">
            Status
            <select
              className={field}
              value={page.status}
              onChange={(e) =>
                update({ status: e.target.value as PageInput["status"] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        )}
        {mode !== "seo" && (
          <MediaField
            label="Header image"
            hint={
              mode === "section" && page.path !== "blog"
                ? "Used when custom rich text replaces the original area."
                : undefined
            }
            value={hero}
            onChange={(image) => {
              setHero(image);
              setMessage("");
            }}
          />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="shop-button w-full disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save page"}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {page.id && mode !== "seo" && (
          <Link
            className="block text-sm underline"
            href={`/admin/pages/${page.id}/preview/`}
            target="_blank"
          >
            Preview saved content ↗
          </Link>
        )}
        {page.id && page.status === "published" && (
          <Link
            className="block text-sm underline"
            href={page.path ? `/${page.path}/` : "/"}
            target="_blank"
          >
            View saved page ↗
          </Link>
        )}
      </aside>
    </div>
  );
}
