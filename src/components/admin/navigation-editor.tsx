"use client";
import { useId, useState } from "react";
import type { NavItem } from "@/lib/navigation";

const field = "w-full rounded border border-black/20 bg-white p-2 text-sm";
const small =
  "rounded border border-black/20 px-2.5 py-1 text-sm disabled:opacity-30";

// Serialises the menu back to the stored "Label | /path/" lines (see
// siteNavigation()). Rows missing a label or link are dropped.
function toLines(items: NavItem[]) {
  return items
    .filter((i) => i.label.trim() && i.href.trim())
    .map((i) => `${i.label.trim()} | ${i.href.trim()}`)
    .join("\n");
}

function move<T>(list: T[], i: number, by: number) {
  const next = [...list];
  [next[i], next[i + by]] = [next[i + by], next[i]];
  return next;
}

// The site menu as rows: label, link (with suggestions of the site's pages),
// reorder and remove. The form posts the lines in a hidden "navigation" field.
export function NavigationEditor({
  initial,
  links,
}: {
  initial: NavItem[];
  links: { label: string; href: string }[];
}) {
  const [items, setItems] = useState<NavItem[]>(initial);
  const listId = useId();
  const update = (i: number, patch: Partial<NavItem>) =>
    setItems(items.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-3">
      <input type="hidden" name="navigation" value={toLines(items)} />
      <datalist id={listId}>
        {links.map((l) => (
          <option key={l.href} value={l.href}>
            {l.label}
          </option>
        ))}
      </datalist>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-2 rounded border border-black/15 bg-white p-3"
        >
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <input
              className={field}
              aria-label={`Menu item ${i + 1} label`}
              placeholder="Label"
              value={item.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <input
              className={field}
              aria-label={`Menu item ${i + 1} link`}
              placeholder="/shop/"
              list={listId}
              value={item.href}
              onChange={(e) => update(i, { href: e.target.value })}
            />
          </div>
          <button
            type="button"
            className={small}
            disabled={i === 0}
            aria-label={`Move ${item.label || "item"} up`}
            onClick={() => setItems(move(items, i, -1))}
          >
            ↑
          </button>
          <button
            type="button"
            className={small}
            disabled={i === items.length - 1}
            aria-label={`Move ${item.label || "item"} down`}
            onClick={() => setItems(move(items, i, 1))}
          >
            ↓
          </button>
          <button
            type="button"
            className="text-coral px-1 text-sm"
            onClick={() => setItems(items.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded border border-black/20 px-3 py-2 text-sm font-semibold"
        onClick={() => setItems([...items, { label: "", href: "" }])}
      >
        Add menu item
      </button>
      <p className="text-muted text-xs">
        Links are paths on this site, such as <code>/shop/</code>, or{" "}
        <code>/#contact</code> for a homepage section. Start typing to pick a
        page. Empty rows are ignored.
      </p>
    </div>
  );
}
