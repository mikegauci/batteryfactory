// Gutenberg/Spectra helpers. Every Rotta post and page starts with a UAG
// "section" hero: a background image with a heading and an optional line
// of text. The image only lives in the block's JSON comment.
import { decodeEntities } from "./wp.ts";

const OPEN = "<!-- wp:uagb/section ";
const CLOSE = "<!-- /wp:uagb/section -->";

export type Hero = { imageUrl: string | null; subtitle: string; rest: string };

export function extractHero(content: string | null | undefined): Hero {
  const html = content ?? "";
  const start = html.indexOf(OPEN);
  // Only a section at the very top counts as the hero.
  if (start === -1 || html.slice(0, start).trim() !== "") {
    return { imageUrl: null, subtitle: "", rest: html };
  }
  const jsonEnd = html.indexOf(" -->", start);
  const end = html.indexOf(CLOSE, jsonEnd);
  if (jsonEnd === -1 || end === -1)
    return { imageUrl: null, subtitle: "", rest: html };

  let imageUrl: string | null = null;
  try {
    const attrs = JSON.parse(html.slice(start + OPEN.length, jsonEnd)) as {
      backgroundImage?: { url?: string };
    };
    imageUrl = attrs.backgroundImage?.url ?? null;
  } catch {
    // Attributes without JSON: no image.
  }
  const section = html.slice(start, end);
  const desc = /class="uagb-desc-text"[^>]*>([\s\S]*?)<\/p>/.exec(section);
  const subtitle = desc
    ? decodeEntities(desc[1].replace(/<[^>]+>/g, "")).trim()
    : "";
  return { imageUrl, subtitle, rest: html.slice(end + CLOSE.length) };
}
