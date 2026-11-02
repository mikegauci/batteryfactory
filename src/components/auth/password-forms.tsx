"use client";

import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/lib/auth/actions";
import { AuthInput, FormMessage, SubmitButton } from "@/components/auth/fields";

export function ResetPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="mt-8 space-y-5">
      <p className="text-white/80">
        Please enter your email address. You will receive a link to create a new
        password via email.
      </p>
      <AuthInput
        label="Email Address*"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <SubmitButton>Reset Password</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="mt-8 space-y-5">
      <AuthInput
        label="New Password*"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <AuthInput
        label="Confirm Password*"
        name="password_confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton>Save Password</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
