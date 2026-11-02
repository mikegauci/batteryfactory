"use server";

import { randomUUID } from "node:crypto";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

export type ContactFields = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export type ContactState =
  { ok?: boolean; error?: string; fields?: ContactFields } | undefined;

const BUCKET = "contact-uploads";
const MAX_BYTES = 20 * 1024 * 1024; // the live form's limit
const ALLOWED_TYPE = /^(image|video|audio)\/[\w.+-]+$/;
// Links in the enquiry email stay valid for 30 days.
const LINK_SECONDS = 30 * 24 * 60 * 60;

// Step 1 of a file upload: the browser asks for a signed URL and uploads the
// file straight to Storage (Vercel functions can't receive 20 MB bodies).
export async function createContactUpload(file: {
  name: string;
  type: string;
  size: number;
}): Promise<{ path: string; token: string } | { error: string }> {
  if (!ALLOWED_TYPE.test(file.type))
    return { error: "Please attach an image, audio or video file." };
  if (!(file.size > 0) || file.size > MAX_BYTES)
    return { error: "The file is too large (20 MB maximum)." };
  const db = createAdminClient();
  if (!db) return { error: "File uploads are not set up yet." };
  const safeName =
    file.name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "upload";
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}/${safeName}`;
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "The file could not be uploaded." };
  return { path: data.path, token: data.token };
}

// The contact form on the homepage (Contact Form 7 on the live site).
export async function sendContactMessage(
  _: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const fields: ContactFields = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
  };
  // Hidden field that only bots fill in.
  if (formData.get("website")) return { ok: true };
  if (!fields.name || !fields.email || !fields.message)
    return { error: "Please fill in the required fields.", fields };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    return { error: "Please enter a valid email address.", fields };
  if (
    fields.name.length > 200 ||
    fields.phone.length > 50 ||
    fields.message.length > 5000
  )
    return { error: "Your message is too long.", fields };

  const rows = [
    { label: "Name", value: fields.name },
    { label: "Email", value: fields.email },
    ...(fields.phone ? [{ label: "Phone", value: fields.phone }] : []),
  ];

  // Only paths issued by createContactUpload are accepted.
  const upload = String(formData.get("upload") ?? "");
  if (upload) {
    if (!/^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\/[\w.-]{1,80}$/.test(upload))
      return { error: "The attached file is invalid.", fields };
    const db = createAdminClient();
    const link = await db?.storage
      .from(BUCKET)
      .createSignedUrl(upload, LINK_SECONDS);
    if (!link?.data)
      return { error: "The attached file could not be found.", fields };
    rows.push({
      label: "File",
      value: `${upload.split("/").pop()}\n${link.data.signedUrl}`,
    });
  }

  const to = process.env.EMAIL_ADMIN_TO || "info@batteryfactory.mt";
  const result = await sendEmail({
    to,
    replyTo: fields.email,
    subject: `Website enquiry from ${fields.name}`,
    heading: "New message from the website",
    paragraphs: fields.message.split(/\n{2,}/),
    rows,
  });
  if (!result.ok)
    return {
      error: "Your message could not be sent. Please try again.",
      fields,
    };
  return { ok: true };
}
