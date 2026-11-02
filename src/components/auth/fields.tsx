"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/auth/actions";

export function AuthInput({
  label,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        placeholder={label}
        className="focus:border-brand w-full rounded-[10px] border border-white bg-transparent px-5 py-3 text-sm leading-[18.2px] text-white placeholder:text-white focus:outline-none"
        {...props}
      />
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand hover:text-brand my-2.5 rounded-[5px] px-5 py-2.5 text-[15px] font-bold tracking-[1px] text-white transition-colors hover:bg-black disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="text-coral text-sm">
        {state.error}
      </p>
    );
  return (
    <p role="status" className="text-brand text-sm">
      {state.message}
    </p>
  );
}
