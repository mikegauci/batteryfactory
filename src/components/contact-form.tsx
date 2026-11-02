"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createContactUpload, sendContactMessage } from "@/lib/contact/actions";

const label = "text-ink text-2xl leading-[2] font-extralight";
const line =
  "block w-full border-0 border-b border-[#414141] bg-transparent px-4 py-3 text-base leading-6 text-[#475569] focus:border-brand focus:outline-none";

// Contact Form 7 layout: labels on the left, underlined fields on the right.
export function ContactForm() {
  const [state, action, pending] = useActionState(
    sendContactMessage,
    undefined,
  );
  const [upload, setUpload] = useState<
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "done"; path: string }
    | { status: "error"; error: string }
  >({ status: "idle" });

  async function onFile(file: File | undefined) {
    if (!file) return setUpload({ status: "idle" });
    setUpload({ status: "uploading" });
    const signed = await createContactUpload({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if ("error" in signed)
      return setUpload({ status: "error", error: signed.error });
    const { error } = await createClient()
      .storage.from("contact-uploads")
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: file.type,
      });
    setUpload(
      error
        ? { status: "error", error: "The file could not be uploaded." }
        : { status: "done", path: signed.path },
    );
  }

  if (state?.ok)
    return (
      <p role="status" className="text-lg">
        Thank you for your message. It has been sent.
      </p>
    );

  const row = "grid items-center gap-x-6 md:grid-cols-[240px_1fr]";
  return (
    <form action={action} className="max-w-[590px] space-y-6">
      <label className={row}>
        <span className={label}>Name*</span>
        <input
          name="name"
          required
          autoComplete="name"
          defaultValue={state?.fields?.name}
          className={line}
        />
      </label>
      <label className={row}>
        <span className={label}>Email*</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state?.fields?.email}
          className={line}
        />
      </label>
      <label className={row}>
        <span className={label}>Phone</span>
        <input
          name="phone"
          autoComplete="tel"
          defaultValue={state?.fields?.phone}
          className={line}
        />
      </label>
      <label className={row}>
        <span className={label}>Message*</span>
        <textarea
          name="message"
          required
          rows={2}
          defaultValue={state?.fields?.message}
          className="focus:border-brand block w-full border border-[#414141] bg-transparent px-2 py-1 text-base text-[#475569] focus:outline-none"
        />
      </label>
      <label className={row}>
        <span className={label}>File Upload</span>
        <span>
          <input
            type="file"
            accept="audio/*,video/*,image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-muted text-sm"
          />
          {upload.status === "uploading" && (
            <span className="text-muted mt-1 block text-sm">Uploading…</span>
          )}
          {upload.status === "error" && (
            <span role="alert" className="text-coral mt-1 block text-sm">
              {upload.error}
            </span>
          )}
        </span>
      </label>
      {upload.status === "done" && (
        <input type="hidden" name="upload" value={upload.path} />
      )}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <button
        type="submit"
        disabled={pending || upload.status === "uploading"}
        className="bf-button text-xl"
      >
        {pending ? "Sending…" : "Submit"}
      </button>
      {state?.error && (
        <p role="alert" className="text-coral text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
