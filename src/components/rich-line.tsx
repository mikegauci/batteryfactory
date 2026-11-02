import { Fragment } from "react";

// Renders a CMS text field: *words* become green highlights (<mark>) and
// **words** bold, matching the emphasis on the WordPress pages. Line breaks
// are kept.
export function RichLine({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line
            .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
            .map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : part.startsWith("*") &&
                part.endsWith("*") &&
                part.length > 2 ? (
                <mark key={j}>{part.slice(1, -1)}</mark>
              ) : (
                part
              ),
            )}
        </Fragment>
      ))}
    </>
  );
}
