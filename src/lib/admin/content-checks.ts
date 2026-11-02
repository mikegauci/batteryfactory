export function brokenInternalLinks(
  html: string,
  known: Set<string>,
): string[] {
  const broken = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["'](\/[^"'\s]*)["']/gi)) {
    const raw = match[1];
    if (raw.startsWith("//")) continue;
    let path: string;
    try {
      path = decodeURI(raw.split(/[?#]/)[0]);
    } catch {
      broken.add(raw);
      continue;
    }
    path = path.replace(/\/+$/, "") || "/";
    if (/^\/product-category\//.test(path)) continue;
    if (!known.has(path)) broken.add(raw);
  }
  return [...broken];
}
