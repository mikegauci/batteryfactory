import { env } from "@/lib/env";

export type EmailContent = {
  // First line of the email, shown large.
  heading: string;
  // Paragraphs of plain text. Escaped before rendering.
  paragraphs: string[];
  // Optional label/value rows, e.g. contact form fields or order totals.
  rows?: { label: string; value: string }[];
  // Optional call-to-action button.
  action?: { label: string; href: string };
};

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#424142;">${escape(text).replace(/\n/g, "<br>")}</p>`;

// Table-based markup with inline styles so it renders in every mail client.
export function renderLayout({
  heading,
  paragraphs,
  rows,
  action,
}: EmailContent) {
  const logo = `${env.siteUrl}/brand/logo-email.png`;

  const rowsHtml = rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">${rows
        .map(
          (row) =>
            `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#7a7a7a;vertical-align:top;white-space:nowrap;">${escape(row.label)}</td><td style="padding:8px 0;border-bottom:1px solid #eeeeee;font-size:14px;color:#424142;">${escape(row.value).replace(/\n/g, "<br>")}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const actionHtml = action
    ? `<p style="margin:8px 0 24px;"><a href="${escape(action.href)}" style="display:inline-block;padding:12px 24px;background:#009245;border-radius:8px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escape(action.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;">
<tr><td style="padding:28px 32px 0;"><a href="${escape(env.siteUrl)}"><img src="${escape(logo)}" alt="Battery Factory" width="180" style="display:block;border:0;height:auto;"></a></td></tr>
<tr><td style="padding:24px 32px 16px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#424142;">${escape(heading)}</h1>
${paragraphs.map(paragraph).join("")}${rowsHtml}${actionHtml}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #eeeeee;font-size:12px;color:#adadad;">Battery Factory · B13b, Bulebel Industrial Estate, Zejtun · <a href="${escape(env.siteUrl)}" style="color:#adadad;">batteryfactory.mt</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(rows ?? []).map((row) => `${row.label}: ${row.value}`),
    ...(action ? ["", `${action.label}: ${action.href}`] : []),
    "",
    "Battery Factory · batteryfactory.mt",
  ].join("\n");

  return { html, text };
}
