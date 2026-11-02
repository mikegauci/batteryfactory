"use client";

import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/lib/auth/actions";
import {
  AccountBox,
  AuthInput,
  FormMessage,
  SubmitButton,
} from "@/components/auth/fields";

// WooCommerce's "Lost your password?" form.
export function ResetPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <AccountBox>
      <form action={action} className="space-y-5">
        <p>
          Lost your password? Please enter your username or email address. You
          will receive a link to create a new password via email.
        </p>
        <AuthInput
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <SubmitButton>Reset password</SubmitButton>
        <FormMessage state={state} />
      </form>
    </AccountBox>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <AccountBox>
      <form action={action} className="space-y-5">
        <p>Enter a new password below.</p>
        <AuthInput
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <AuthInput
          label="Re-enter new password"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton>Save</SubmitButton>
        <FormMessage state={state} />
      </form>
    </AccountBox>
  );
}
