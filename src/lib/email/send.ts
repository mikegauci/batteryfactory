import "server-only";
import { renderLayout, type EmailContent } from "./layout";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "info@batteryfactory.mt";
const FROM_NAME = "Battery Factory";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type SendEmailInput = EmailContent & {
  to: string | string[];
  subject: string;
  replyTo?: string;
  // Sent to Mailjet as CustomID so retries can be traced in its logs.
  idempotencyKey?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  { ok: true; id: string } | { ok: false; error: string };

// Sends a transactional email with the Battery Factory layout through the
// Mailjet Send API v3.1. Without MAILJET_API_KEY/SECRET (local dev) it logs
// the email instead of sending it.
export async function sendEmail({
  to,
  subject,
  replyTo,
  idempotencyKey,
  attachments,
  ...content
}: SendEmailInput): Promise<SendEmailResult> {
  const { html, text } = renderLayout(content);
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_API_SECRET;

  if (!key || !secret) {
    console.info(
      `[email] Mailjet keys not set; not sending "${subject}" to ${to}\n${text}`,
    );
    return { ok: true, id: "dev-noop" };
  }

  const message = {
    From: { Email: FROM_EMAIL, Name: FROM_NAME },
    To: (Array.isArray(to) ? to : [to]).map((Email) => ({ Email })),
    Subject: subject,
    TextPart: text,
    HTMLPart: html,
    ...(replyTo ? { ReplyTo: { Email: replyTo } } : {}),
    ...(idempotencyKey ? { CustomID: idempotencyKey.slice(0, 255) } : {}),
    ...(attachments?.length
      ? {
          Attachments: attachments.map((a) => ({
            ContentType: a.contentType,
            Filename: a.filename,
            Base64Content: a.content.toString("base64"),
          })),
        }
      : {}),
  };

  try {
    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Messages: [message] }),
    });
    const body = (await response.json().catch(() => null)) as {
      Messages?: {
        Status: string;
        To?: { MessageID: number | string }[];
        Errors?: { ErrorMessage: string }[];
      }[];
      ErrorMessage?: string;
    } | null;
    const result = body?.Messages?.[0];
    if (!response.ok || result?.Status !== "success") {
      const error =
        result?.Errors?.map((e) => e.ErrorMessage).join("; ") ||
        body?.ErrorMessage ||
        `Mailjet returned ${response.status}`;
      console.error("[email] send failed", error);
      return { ok: false, error };
    }
    return { ok: true, id: String(result.To?.[0]?.MessageID ?? "") };
  } catch (error) {
    console.error("[email] send failed", error);
    return { ok: false, error: "Could not reach the email service" };
  }
}
